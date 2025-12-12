import type { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { LRUCache } from "lru-cache";
import type postgres from "postgres";

import { createLogger } from "@manylead/clients/logger";
import { createPostgresClient } from "@manylead/clients/postgres";
import { createQueue } from "@manylead/clients/queue";
import { createRedisClient } from "@manylead/clients/redis";
import { encrypt, decrypt } from "@manylead/crypto";

import type { Tenant, DecryptedTenant } from "@manylead/db";
import * as schema from "@manylead/db";
import { databaseHost, organization, tenant } from "@manylead/db";

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
import { setupTimescaleDB } from "./timescale";
import { seedTenantDefaults } from "./seed-tenant";

// Migrations path from env (supports both local dev and Docker)
const TENANT_MIGRATIONS_PATH = env.TENANT_MIGRATIONS_PATH;

export class TenantDatabaseManager {
  private catalogDb;
  private catalogClient;
  private activityLogger: ActivityLogger;
  private tenantProvisioningQueue: Queue;
  private tenantCache: TenantCache;
  private logger;

  // LRU cache: prevents memory leak from unbounded Map
  // With max 100 tenants cached, ~5MB total (50KB per client)
  // LRU evicts least-recently-used when full
  private clientCache = new LRUCache<string, ReturnType<typeof postgres>>({
    max: 100, // Max 100 cached clients
    ttl: 1000 * 60 * 30, // 30 minutes TTL
    updateAgeOnGet: true, // Reset TTL on access
  });

  constructor(catalogConnectionString?: string) {
    // Use PgBouncer by default for better connection pooling
    const connString = catalogConnectionString ?? env.DATABASE_URL;

    if (!connString) {
      throw new Error("Missing catalog database connection string");
    }

    // Initialize logger for structured logging
    this.logger = createLogger({ component: "TenantManager" });

    // Create Postgres client using factory (pgbouncer preset)
    this.catalogClient = createPostgresClient({
      connectionString: connString,
      preset: "pgbouncer",
      logger: this.logger,
    });

    this.catalogDb = drizzle(this.catalogClient, { schema });

    // ActivityLogger should also use PgBouncer
    this.activityLogger = new ActivityLogger(connString);

    // Create Redis connection using factory (queue preset)
    const redisConnection = createRedisClient({
      url: env.REDIS_URL,
      preset: "queue",
      logger: this.logger,
    });

    // Create BullMQ queue using factory
    this.tenantProvisioningQueue = createQueue({
      name: env.QUEUE_TENANT_PROVISIONING,
      connection: redisConnection,
      preset: "default",
      logger: this.logger,
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

    // IMPORTANTE: Connection string do tenant SEMPRE usa porta direta (não PgBouncer)
    // PgBouncer em transaction mode não suporta CREATE EXTENSION e migrations
    // Runtime queries (SELECT/INSERT/UPDATE) podem usar PgBouncer se necessário
    const connectionString = buildConnectionString({
      host: host.host,
      port: host.port, // Porta direta, não PgBouncer
      database: dbName,
      user: postgresUser,
      password: postgresPassword,
    });

    // Encrypt connection string
    const encryptedConnectionString = encrypt(connectionString);

    // Criar registro do tenant com status "provisioning"
    const result = await this.catalogDb
      .insert(tenant)
      .values({
        organizationId: params.organizationId,
        slug: params.slug,
        name: params.name,
        databaseName: dbName,
        connectionStringEncrypted: encryptedConnectionString.encrypted,
        connectionStringIv: encryptedConnectionString.iv,
        connectionStringTag: encryptedConnectionString.tag,
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
  ): Promise<DecryptedTenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    const encryptedTenant = result[0];
    if (!encryptedTenant) return null;

    return this.decryptTenantConnectionString(encryptedTenant);
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

      // Create admin client for database creation (admin preset)
      const adminClient = createPostgresClient({
        connectionString: adminConnString,
        preset: "admin",
        logger: this.logger,
      });

      // Criar banco de dados físico
      await adminClient.unsafe(
        `CREATE DATABASE "${existingTenant.databaseName}"`,
      );
      await adminClient.end();

      // Decrypt connection string
      const connectionString = decrypt<string>({
        encrypted: existingTenant.connectionStringEncrypted,
        iv: existingTenant.connectionStringIv,
        tag: existingTenant.connectionStringTag,
      });

      // Create tenant client for migrations (migration preset)
      const tenantClient = createPostgresClient({
        connectionString,
        preset: "migration",
        logger: this.logger,
      });

      // Criar extensões
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS timescaledb");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS dblink");

      // Rodar migrations do tenant
      const tenantDb = drizzle({
        client: tenantClient,
        schema,
        casing: "snake_case",
      });
      await migrate(tenantDb, { migrationsFolder: TENANT_MIGRATIONS_PATH });

      // Configurar TimescaleDB hypertables (particionamento automático + compression + retention)
      this.logger.info(
        { databaseName: existingTenant.databaseName },
        "Setting up TimescaleDB",
      );
      await setupTimescaleDB(tenantClient);

      // Seed de dados padrões (tags e endings)
      this.logger.info(
        { organizationId: existingTenant.organizationId },
        "Seeding tenant defaults",
      );
      await seedTenantDefaults(tenantClient, existingTenant.organizationId);

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
    let tenantRecord: DecryptedTenant | null =
      (await this.tenantCache.get(organizationId)) as DecryptedTenant | null;

    if (!tenantRecord) {
      // Redis cache miss - query catalog database
      const result = await this.catalogDb
        .select()
        .from(tenant)
        .where(eq(tenant.organizationId, organizationId))
        .limit(1);

      const encryptedTenant = result[0] ?? null;

      if (encryptedTenant) {
        // Decrypt connection string once (only on cache miss)
        tenantRecord = this.decryptTenantConnectionString(encryptedTenant);

        // Save to Redis cache for next time (already decrypted)
        await this.tenantCache.set(organizationId, tenantRecord as Tenant);
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

    // LRU cache pattern: reuse client if already exists for this connection string
    // LRU automatically evicts least-recently-used when max is reached
    let client = this.clientCache.get(tenantRecord.connectionString);

    if (!client) {
      // Create new postgres client using factory (pgbouncer preset)
      client = createPostgresClient({
        connectionString: tenantRecord.connectionString,
        preset: "pgbouncer",
        logger: this.logger,
      });

      this.clientCache.set(tenantRecord.connectionString, client);
    }

    return drizzle({
      client,
      schema,
      casing: "snake_case",
    });
  }

  /**
   * Get direct connection (bypass pgbouncer) for administrative operations
   * Use this during provisioning to avoid CONNECTION_ENDED errors
   */
  async getDirectConnection(organizationId: string) {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    const encryptedTenant = result[0] ?? null;

    if (!encryptedTenant) {
      throw new Error(`Tenant not found: ${organizationId}`);
    }

    // Decrypt connection string
    const tenantRecord = this.decryptTenantConnectionString(encryptedTenant);

    // Convert pgbouncer port (6432) to direct port (5432)
    const directConnectionString = tenantRecord.connectionString.replace(
      ":6432/",
      ":5432/",
    );

    // Create direct client (no caching - for one-time admin operations)
    const client = createPostgresClient({
      connectionString: directConnectionString,
      preset: "migration", // Use migration preset (prepare: false, max: 1)
      logger: this.logger,
    });

    return drizzle({
      client,
      schema,
      casing: "snake_case",
    });
  }

  /**
   * Helper function to decrypt connection string from tenant record
   */
  private decryptTenantConnectionString(
    encryptedTenant: Tenant,
  ): DecryptedTenant {
    const connectionString = decrypt<string>({
      encrypted: encryptedTenant.connectionStringEncrypted,
      iv: encryptedTenant.connectionStringIv,
      tag: encryptedTenant.connectionStringTag,
    });

    return {
      ...encryptedTenant,
      connectionString,
    } as DecryptedTenant;
  }

  async getTenantBySlug(slug: string): Promise<DecryptedTenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.slug, slug))
      .limit(1);

    const encryptedTenant = result[0];
    if (!encryptedTenant) return null;

    return this.decryptTenantConnectionString(encryptedTenant);
  }

  async getTenantById(tenantId: string): Promise<DecryptedTenant | null> {
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.id, tenantId))
      .limit(1);

    const encryptedTenant = result[0];
    if (!encryptedTenant) return null;

    return this.decryptTenantConnectionString(encryptedTenant);
  }

  async migrateTenant(tenantId: string): Promise<void> {
    const tenantRecord = await this.getTenantById(tenantId);

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    await this.activityLogger.logMigrationStarted(tenantId, "all");

    const startTime = Date.now();

    try {
      // Create client for migration (migration preset)
      const client = createPostgresClient({
        connectionString: tenantRecord.connectionString,
        preset: "migration",
        logger: this.logger,
      });

      const db = drizzle({
        client,
        schema,
        casing: "snake_case",
      });
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
      // Create client for health check (admin preset)
      const client = createPostgresClient({
        connectionString: tenantRecord.connectionString,
        preset: "admin",
        logger: this.logger,
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

    // ALWAYS invalidate cache when status changes (fresh data on next getConnection)
    if (tenantRecord) {
      await this.tenantCache.invalidate(tenantRecord.organizationId);
      this.logger.info(
        { organizationId: tenantRecord.organizationId, status },
        "Invalidated cache for tenant",
      );
    }
  }

  async deleteTenant(organizationId: string, userId?: string): Promise<void> {
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

    // Soft delete - marca como deleted, renomeia slug e name para liberar constraint UNIQUE
    const timestamp = Date.now();

    // 1. Renomear organização no Better Auth (liberar constraint UNIQUE de slug)
    await this.catalogDb
      .update(organization)
      .set({
        slug: `${tenantRecord.slug}-deleted-${timestamp}`,
        name: `${tenantRecord.name} (deleted)`,
      })
      .where(eq(organization.id, organizationId));

    // 2. Soft delete do tenant
    await this.catalogDb
      .update(tenant)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        slug: `${tenantRecord.slug}-deleted-${timestamp}`,
        name: `${tenantRecord.name} (deleted)`,
      })
      .where(eq(tenant.id, tenantRecord.id));

    await this.activityLogger.logTenantDeleted(
      tenantRecord.id,
      tenantRecord.slug,
      userId,
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

    // Create admin client for database deletion (admin preset)
    const adminClient = createPostgresClient({
      connectionString: adminConnString,
      preset: "admin",
      logger: this.logger,
    });

    try {
      // Terminate all connections to the database before dropping
      await adminClient.unsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${tenantRecord.databaseName}'
        AND pid <> pg_backend_pid()
      `);

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
    // Close all cached tenant clients from LRU cache
    for (const [, client] of this.clientCache.entries()) {
      await client.end({ timeout: 5 });
    }
    this.clientCache.clear();

    await this.tenantProvisioningQueue.close();
    await this.catalogClient.end();
    await this.activityLogger.close();
  }
}
