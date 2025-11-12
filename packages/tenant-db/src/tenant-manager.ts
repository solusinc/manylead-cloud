import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import Redis from "ioredis";
import postgres from "postgres";

import type { Tenant } from "@manylead/db";
import * as catalogSchema from "@manylead/db";
import { databaseHost, tenant } from "@manylead/db";

import type {
  HealthCheckResult,
  MigrateAllOptions,
  MigrationResult,
  ProvisionTenantParams,
} from "./types";
import { ActivityLogger } from "./activity-logger";
import { TenantCache } from "./cache/tenant-cache";
import { env } from "./env";
import {
  buildConnectionString,
  generateDatabaseName,
  isValidSlug,
  retryWithBackoff,
} from "./utils";

// Migrations path from env (supports both local dev and Docker)
const TENANT_MIGRATIONS_PATH = env.TENANT_MIGRATIONS_PATH;

export class TenantDatabaseManager {
  private catalogDb;
  private catalogClient;
  private activityLogger: ActivityLogger;
  private tenantProvisioningQueue: Queue;
  private tenantCache: TenantCache;

  // Singleton cache: one postgres client per unique connection string
  // Prevents memory leak from creating unlimited client objects
  // With max 3 orgs per user, RAM impact is negligible (~50KB per client)
  private clientCache = new Map<string, ReturnType<typeof postgres>>();

  constructor(catalogConnectionString?: string) {
    // Use PgBouncer by default for better connection pooling
    const connString = catalogConnectionString ?? env.DATABASE_URL;

    if (!connString) {
      throw new Error("Missing catalog database connection string");
    }

    // PgBouncer transaction mode: need VERY few connections per instance
    // PgBouncer reuses connections efficiently, so max: 2-3 is enough
    this.catalogClient = postgres(connString, {
      max: 3, // Small pool - PgBouncer handles the real pooling
      idle_timeout: 20, // Short timeout - PgBouncer manages connection lifecycle
      connect_timeout: 10,
      max_lifetime: null, // No limit - let PgBouncer recycle connections
      prepare: false, // Required for PgBouncer transaction mode
    });

    this.catalogDb = drizzle(this.catalogClient, { schema: catalogSchema });
    // ActivityLogger should also use PgBouncer
    this.activityLogger = new ActivityLogger(connString);

    // Initialize BullMQ queue for async provisioning
    // PERFORMANCE OPTIMIZATION for high-latency networks:
    // - enableAutoPipelining: Automatically batches commands into pipelines
    //   reducing network roundtrips from 5-10× to 1× per operation
    // - keepAlive: Maintains TCP connection alive, avoiding reconnection overhead
    const redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires null for blocking commands
      lazyConnect: false, // Connect immediately
      enableAutoPipelining: true, // CRITICAL: Batches commands automatically
      keepAlive: 30000, // Keep TCP connection alive for 30 seconds
      connectTimeout: 10000, // 10 second timeout for initial connection
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Log only errors
    redisConnection.on("error", (error) => {
      console.error("[TenantManager] Redis connection error:", error);
    });

    this.tenantProvisioningQueue = new Queue(env.QUEUE_TENANT_PROVISIONING, {
      connection: redisConnection,
    });

    // Initialize Redis-based tenant cache
    this.tenantCache = new TenantCache(redisConnection);
  }

  /**
   * Provisiona um tenant de forma assíncrona usando BullMQ
   *
   * Este método:
   * 1. Cria o registro do tenant com status "provisioning"
   * 2. Enfileira um job no BullMQ para processar o provisioning
   * 3. Retorna imediatamente (não bloqueia)
   *
   * O worker processa o job e atualiza o status para "active" quando pronto
   */
  async provisionTenantAsync(params: ProvisionTenantParams): Promise<Tenant> {
    if (!isValidSlug(params.slug)) {
      throw new Error(`Invalid slug: ${params.slug}`);
    }

    // Verificar se já existe tenant com esse slug
    const existingTenant = await this.getTenantBySlug(params.slug);
    if (existingTenant) {
      throw new Error(
        `Tenant with slug '${params.slug}' already exists (status: ${existingTenant.status})`,
      );
    }

    const dbName = generateDatabaseName(params.organizationId);

    let host;
    if (params.databaseHostId) {
      const result = await this.catalogDb
        .select()
        .from(databaseHost)
        .where(eq(databaseHost.id, params.databaseHostId))
        .limit(1);

      if (!result[0]) {
        throw new Error(`Database host not found: ${params.databaseHostId}`);
      }

      host = result[0];
    } else {
      const result = await this.catalogDb
        .select()
        .from(databaseHost)
        .where(eq(databaseHost.isDefault, true))
        .limit(1);

      if (!result[0]) {
        throw new Error("No default database host found");
      }

      host = result[0];
    }

    const postgresUser = env.POSTGRES_USER;
    const postgresPassword = env.POSTGRES_PASSWORD;

    const hasPgBouncer = host.capabilities?.features?.includes("pgbouncer");
    const connectionPort = hasPgBouncer ? 6432 : host.port;

    const connectionString = buildConnectionString({
      host: host.host,
      port: connectionPort,
      database: dbName,
      user: postgresUser,
      password: postgresPassword,
    });

    // Criar registro do tenant com status "provisioning"
    const result = await this.catalogDb
      .insert(tenant)
      .values({
        organizationId: params.organizationId,
        slug: params.slug,
        name: params.name,
        databaseName: dbName,
        connectionString,
        databaseHostId: host.id,
        host: host.host,
        port: connectionPort, // Use connection port (6432 if PgBouncer, host.port otherwise)
        region: host.region,
        tier: params.tier ?? "shared",
        status: "provisioning",
        metadata: params.metadata,
      })
      .returning();

    const newTenant = result[0];

    if (!newTenant) {
      throw new Error("Failed to create tenant record");
    }

    await this.activityLogger.logTenantCreated(
      newTenant.id,
      newTenant.slug,
      params.metadata,
    );

    // Enfileirar job para processar provisionamento
    const job = await this.tenantProvisioningQueue.add(
      "provision-tenant",
      {
        organizationId: params.organizationId,
        organizationName: params.name,
        organizationSlug: params.slug,
        ownerId: params.ownerId ?? "", // userId do owner (será criado o agent)
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 500,
        },
      },
    );

    // Atualizar provisioning_details com jobId
    await this.catalogDb
      .update(tenant)
      .set({
        provisioningDetails: {
          jobId: job.id,
          progress: 0,
          currentStep: "queued",
          startedAt: new Date().toISOString(),
        },
      })
      .where(eq(tenant.id, newTenant.id));

    return newTenant;
  }

  /**
   * Busca tenant por organization ID
   */
  async getTenantByOrganization(
    organizationId: string,
  ): Promise<Tenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    return result[0] ?? null;
  }

  /**
   * Completa o provisioning físico de um tenant (CREATE DATABASE + migrations)
   *
   * Este método é chamado pelo worker após o tenant record já ter sido criado
   * pelo provisionTenantAsync()
   */
  async completeTenantProvisioning(organizationId: string): Promise<Tenant> {
    const startTime = Date.now();

    // Buscar tenant existente
    const existingTenant = await this.getTenantByOrganization(organizationId);

    if (!existingTenant) {
      throw new Error(`Tenant not found for organization ${organizationId}`);
    }

    if (existingTenant.status === "active") {
      return existingTenant;
    }

    try {
      const postgresUser = env.POSTGRES_USER;
      const postgresPassword = env.POSTGRES_PASSWORD;

      // Buscar host do tenant
      const hostResult = await this.catalogDb
        .select()
        .from(databaseHost)
        .where(eq(databaseHost.id, existingTenant.databaseHostId))
        .limit(1);

      const host = hostResult[0];
      if (!host) {
        throw new Error(
          `Database host not found: ${existingTenant.databaseHostId}`,
        );
      }

      const adminConnString = buildConnectionString({
        host: host.host,
        port: host.port,
        database: "postgres",
        user: postgresUser,
        password: postgresPassword,
      });

      const adminClient = postgres(adminConnString, { max: 1 });

      // Criar banco de dados físico
      await adminClient.unsafe(
        `CREATE DATABASE "${existingTenant.databaseName}"`,
      );
      await adminClient.end();

      const tenantClient = postgres(existingTenant.connectionString, {
        max: 1,
        prepare: false,
      });

      // Criar extensões
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS pg_partman");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS dblink");

      // Rodar migrations do tenant
      const tenantDb = drizzle(tenantClient);
      await migrate(tenantDb, { migrationsFolder: TENANT_MIGRATIONS_PATH });

      await tenantClient.end();

      // Atualizar status para active
      await this.catalogDb
        .update(tenant)
        .set({
          status: "active",
          provisionedAt: new Date(),
        })
        .where(eq(tenant.id, existingTenant.id));

      const duration = Date.now() - startTime;
      await this.activityLogger.logTenantProvisioned(
        existingTenant.id,
        existingTenant.databaseName,
        duration,
      );

      return { ...existingTenant, status: "active", provisionedAt: new Date() };
    } catch (error) {
      await this.catalogDb
        .update(tenant)
        .set({ status: "failed" })
        .where(eq(tenant.id, existingTenant.id));

      await this.activityLogger.logSystemError(error as Error, {
        tenantId: existingTenant.id,
        slug: existingTenant.slug,
      });

      throw error;
    }
  }

  async getConnection(organizationId: string) {
    // Try Redis cache (distributed)
    let tenantRecord = await this.tenantCache.get(organizationId);

    if (tenantRecord) {
      console.log(`[TenantManager] ✅ Redis cache HIT for ${organizationId}`);
    } else {
      console.log(`[TenantManager] ❌ Redis cache MISS for ${organizationId}`);

      // Redis cache miss - query catalog database
      const result = await this.catalogDb
        .select()
        .from(tenant)
        .where(eq(tenant.organizationId, organizationId))
        .limit(1);

      tenantRecord = result[0] ?? null;

      // Save to Redis cache for next time
      if (tenantRecord) {
        await this.tenantCache.set(organizationId, tenantRecord);
        console.log(`[TenantManager] ✅ Saved to Redis cache for ${organizationId}`);
      }
    }

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${organizationId}`);
    }

    if (tenantRecord.status !== "active") {
      throw new Error(
        `Tenant is not active: ${tenantRecord.slug} (status: ${tenantRecord.status})`,
      );
    }

    console.log(
      `[TenantManager] Creating connection to ${tenantRecord.databaseName} via ${tenantRecord.port === 6432 ? "PgBouncer" : "PostgreSQL direct"}`,
    );

    // Singleton pattern: reuse client if already exists for this connection string
    // Prevents memory leak from creating unlimited client objects
    let client = this.clientCache.get(tenantRecord.connectionString);

    if (!client) {
      console.log(
        `[TenantManager] 🆕 Creating new postgres client for ${tenantRecord.databaseName}`,
      );

      // Create new postgres client (lightweight wrapper, not a real TCP connection)
      // PgBouncer handles connection pooling centrally
      // Small pool size: PgBouncer reuses connections efficiently across all app instances
      client = postgres(tenantRecord.connectionString, {
        max: 2, // Small pool - PgBouncer does the real pooling
        idle_timeout: 20,
        connect_timeout: 10,
        max_lifetime: null,
        prepare: false, // Required for PgBouncer transaction mode
      });

      this.clientCache.set(tenantRecord.connectionString, client);
    }

    return drizzle(client);
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.slug, slug))
      .limit(1);

    return result[0] ?? null;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    return result[0] ?? null;
  }

  async migrateTenant(tenantId: string): Promise<void> {
    const tenantRecord = await this.getTenantById(tenantId);

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    await this.activityLogger.logMigrationStarted(tenantId, "all");

    const startTime = Date.now();

    try {
      const client = postgres(tenantRecord.connectionString, {
        max: 1,
        prepare: false,
      });

      const db = drizzle(client);
      await migrate(db, { migrationsFolder: TENANT_MIGRATIONS_PATH });
      await client.end();

      const duration = Date.now() - startTime;
      await this.activityLogger.logMigrationExecuted(tenantId, "all", duration);
    } catch (error) {
      await this.activityLogger.logMigrationFailed(
        tenantId,
        "all",
        (error as Error).message,
      );
      throw error;
    }
  }

  async migrateAll(options?: MigrateAllOptions): Promise<MigrationResult[]> {
    const parallel = options?.parallel ?? true;
    const maxConcurrency = options?.maxConcurrency ?? 5;
    const continueOnError = options?.continueOnError ?? false;

    const tenants = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.status, "active"));

    const results: MigrationResult[] = [];

    if (!parallel) {
      for (const t of tenants) {
        const startTime = Date.now();
        try {
          await this.migrateTenant(t.id);
          results.push({
            tenantId: t.id,
            slug: t.slug,
            success: true,
            duration: Date.now() - startTime,
          });
        } catch (error) {
          results.push({
            tenantId: t.id,
            slug: t.slug,
            success: false,
            duration: Date.now() - startTime,
            error: (error as Error).message,
          });

          if (!continueOnError) {
            throw error;
          }
        }
      }
    } else {
      const chunks: Tenant[][] = [];
      for (let i = 0; i < tenants.length; i += maxConcurrency) {
        chunks.push(tenants.slice(i, i + maxConcurrency));
      }

      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(async (t) => {
            const startTime = Date.now();
            await this.migrateTenant(t.id);
            return {
              tenantId: t.id,
              slug: t.slug,
              success: true,
              duration: Date.now() - startTime,
            };
          }),
        );

        for (let i = 0; i < chunkResults.length; i++) {
          const result = chunkResults[i];
          const t = chunk[i];

          if (!t || !result) continue;

          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            const errorMessage =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
            results.push({
              tenantId: t.id,
              slug: t.slug,
              success: false,
              duration: 0,
              error: errorMessage,
            });
          }
        }
      }
    }

    return results;
  }

  async checkTenantHealth(tenantId: string): Promise<HealthCheckResult> {
    const tenantRecord = await this.getTenantById(tenantId);

    if (!tenantRecord) {
      return {
        tenantId,
        slug: "unknown",
        status: "unhealthy",
        canConnect: false,
        databaseExists: false,
        error: "Tenant not found",
      };
    }

    try {
      const client = postgres(tenantRecord.connectionString, {
        max: 1,
        prepare: false,
      });

      await retryWithBackoff(() => client`SELECT 1`, {
        maxAttempts: 3,
        delayMs: 500,
      });

      // Buscar extensões instaladas
      const extensionsResult = await client<{ extname: string }[]>`
        SELECT extname FROM pg_extension WHERE extname != 'plpgsql'
      `;
      const extensions = extensionsResult.map((row) => row.extname);

      await client.end();

      return {
        tenantId: tenantRecord.id,
        slug: tenantRecord.slug,
        status: "healthy",
        canConnect: true,
        databaseExists: true,
        extensions,
        schemaVersion:
          typeof tenantRecord.metadata?.schemaVersion === "string"
            ? tenantRecord.metadata.schemaVersion
            : undefined,
      };
    } catch (error) {
      return {
        tenantId: tenantRecord.id,
        slug: tenantRecord.slug,
        status: "unhealthy",
        canConnect: false,
        databaseExists: false,
        error: (error as Error).message,
      };
    }
  }

  async checkAllTenantsHealth(): Promise<HealthCheckResult[]> {
    const tenants = await this.catalogDb.select().from(tenant);
    const results = await Promise.all(
      tenants.map((t) => this.checkTenantHealth(t.id)),
    );
    return results;
  }

  async updateTenantStatus(
    tenantId: string,
    status: "provisioning" | "active" | "suspended" | "deleted" | "failed",
  ): Promise<void> {
    // Get tenant to find organizationId for cache invalidation
    const tenantRecord = await this.getTenantById(tenantId);

    await this.catalogDb
      .update(tenant)
      .set({ status })
      .where(eq(tenant.id, tenantId));

    // Invalidate Redis cache if tenant is no longer active
    if (status !== "active" && tenantRecord) {
      await this.tenantCache.invalidate(tenantRecord.organizationId);
    }
  }

  async deleteTenant(organizationId: string): Promise<void> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    const tenantRecord = result[0];

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${organizationId}`);
    }

    // Invalidate Redis cache
    await this.tenantCache.invalidate(organizationId);

    // Soft delete - marca como deleted mas mantém database físico
    await this.catalogDb
      .update(tenant)
      .set({
        status: "deleted",
        deletedAt: new Date(),
      })
      .where(eq(tenant.id, tenantRecord.id));

    await this.activityLogger.logTenantDeleted(
      tenantRecord.id,
      tenantRecord.slug,
    );
  }

  async purgeTenant(organizationId: string): Promise<void> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    const tenantRecord = result[0];

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${organizationId}`);
    }

    // Invalidate Redis cache
    await this.tenantCache.invalidate(organizationId);

    const postgresUser = env.POSTGRES_USER;
    const postgresPassword = env.POSTGRES_PASSWORD;

    // Logar ANTES de deletar (senão viola foreign key)
    await this.activityLogger.logTenantDeleted(
      tenantRecord.id,
      tenantRecord.slug,
    );

    // Hard delete - deleta database físico e registro do catalog
    const adminConnString = buildConnectionString({
      host: tenantRecord.host,
      port: tenantRecord.port,
      database: "postgres",
      user: postgresUser,
      password: postgresPassword,
    });

    const adminClient = postgres(adminConnString, { max: 1 });

    try {
      await adminClient.unsafe(
        `DROP DATABASE IF EXISTS "${tenantRecord.databaseName}"`,
      );
    } finally {
      await adminClient.end();
    }

    // Deletar registro do catalog (CASCADE vai deletar activity_log, metrics, etc)
    await this.catalogDb.delete(tenant).where(eq(tenant.id, tenantRecord.id));
  }

  async close(): Promise<void> {
    // Close all cached tenant clients
    for (const client of this.clientCache.values()) {
      await client.end({ timeout: 5 });
    }
    this.clientCache.clear();

    await this.tenantProvisioningQueue.close();
    await this.catalogClient.end();
    await this.activityLogger.close();
  }
}
