import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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
import { env } from "./env";
import {
  buildConnectionString,
  generateDatabaseName,
  isValidSlug,
  retryWithBackoff,
} from "./utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TENANT_MIGRATIONS_PATH = join(__dirname, "..", "drizzle", "tenant");

export class TenantDatabaseManager {
  private catalogDb;
  private catalogClient;
  private activityLogger: ActivityLogger;

  // TODO: Implementar cache distribuído com Redis para query results
  //
  // ESTRATÉGIA ATUAL (in-memory Map):
  // - ✅ Funciona bem em single-instance (380ms em cache hit)
  // - ❌ Não compartilha cache entre múltiplas instâncias do Node.js
  // - ❌ Perde cache em restart/deploy
  // - ❌ Limitado pela memória RAM de uma única máquina
  //
  // ESTRATÉGIA FUTURA (Redis):
  // - ✅ Cache distribuído entre todas as instâncias
  // - ✅ Persiste entre deploys
  // - ✅ Suporta TTL e invalidação granular
  // - ✅ Redução esperada: ~95% (380ms → ~50ms em warm cache)
  //
  // QUANDO IMPLEMENTAR:
  // - Ao escalar horizontalmente (múltiplas instâncias do Node.js)
  // - Quando frequência de deploy causar muitos cache misses
  //
  // IMPLEMENTAÇÃO SUGERIDA:
  // 1. Cache de conexões (connection pooling) - mantém Map atual
  // 2. Cache de query results (tenant metadata, agents, etc) - novo com Redis
  //    - Key: `tenant:${organizationId}:metadata`
  //    - Value: JSON serializado do tenant record
  //    - TTL: 5-10 minutos
  // 3. Cache invalidation:
  //    - On tenant update/delete: invalidar chave específica
  //    - On agent role change: invalidar queries relacionadas
  // 4. Fallback strategy: Redis down → bypass cache, query DB directly
  //
  // LIBS SUGERIDAS:
  // - ioredis (cliente Redis robusto)
  // - @vercel/kv (se usar Vercel, abstração sobre Redis)
  //
  // Connection pool cache: organizationId -> { client, db, connectionString }
  private connectionCache = new Map<
    string,
    {
      client: ReturnType<typeof postgres>;
      db: ReturnType<typeof drizzle>;
      connectionString: string;
    }
  >();

  constructor(catalogConnectionString?: string) {
    // Use PgBouncer by default for better connection pooling
    const connString = catalogConnectionString ?? env.DATABASE_URL;

    if (!connString) {
      throw new Error("Missing catalog database connection string");
    }

    this.catalogClient = postgres(connString, {
      max: 10,
      idle_timeout: 300, // Keep connections alive for 5 minutes
      connect_timeout: 10,
      max_lifetime: 60 * 30, // 30 minutes
      prepare: false,
    });

    this.catalogDb = drizzle(this.catalogClient, { schema: catalogSchema });
    // ActivityLogger should also use PgBouncer
    this.activityLogger = new ActivityLogger(connString);
  }

  async provisionTenant(params: ProvisionTenantParams): Promise<Tenant> {
    const startTime = Date.now();

    // TODO FASE-3: Mover provisionamento para worker/background job
    // Benefícios:
    // - Não bloqueia request HTTP (evita timeout em provisioning lento)
    // - Melhor UX: usuário vê progresso em tempo real
    // - Retry automático em caso de falha
    // - Monitoramento e observabilidade melhores
    // Implementação sugerida:
    // - Criar queue (BullMQ ou similar)
    // - Status "provisioning" -> websocket/polling na UI
    // - Worker processa: CREATE DB -> migrations -> extensions -> update status "active"
    // - UI recebe notificação quando pronto

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

    // Use PgBouncer port (6432) if available for tenant databases
    // PgBouncer is configured with wildcard (*) to accept any database dynamically
    const hasPgBouncer = host.capabilities?.features?.includes("pgbouncer");
    const connectionPort = hasPgBouncer ? 6432 : host.port;

    const connectionString = buildConnectionString({
      host: host.host,
      port: connectionPort,
      database: dbName,
      user: postgresUser,
      password: postgresPassword,
    });

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
        port: host.port,
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

    try {
      const adminConnString = buildConnectionString({
        host: host.host,
        port: host.port,
        database: "postgres",
        user: postgresUser,
        password: postgresPassword,
      });

      const adminClient = postgres(adminConnString, { max: 1 });

      await adminClient.unsafe(`CREATE DATABASE "${dbName}"`);
      await adminClient.end();

      const tenantClient = postgres(connectionString, {
        max: 1,
        prepare: false,
      });

      // Criar extensões disponíveis no servidor
      // NOTA: pg_cron só pode ser criado no database configurado em cron.database_name (manylead_catalog)
      // Para jobs agendados nos tenants, use pg_cron no catalog + dblink
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS pg_partman");
      await tenantClient.unsafe("CREATE EXTENSION IF NOT EXISTS dblink");

      // Rodar migrations do tenant
      const tenantDb = drizzle(tenantClient);
      await migrate(tenantDb, { migrationsFolder: TENANT_MIGRATIONS_PATH });

      await tenantClient.end();

      await this.catalogDb
        .update(tenant)
        .set({
          status: "active",
          provisionedAt: new Date(),
        })
        .where(eq(tenant.id, newTenant.id));

      const duration = Date.now() - startTime;
      await this.activityLogger.logTenantProvisioned(
        newTenant.id,
        dbName,
        duration,
      );

      return { ...newTenant, status: "active", provisionedAt: new Date() };
    } catch (error) {
      await this.catalogDb
        .update(tenant)
        .set({ status: "failed" })
        .where(eq(tenant.id, newTenant.id));

      await this.activityLogger.logSystemError(error as Error, {
        tenantId: newTenant.id,
        slug: params.slug,
      });

      throw error;
    }
  }

  async getConnection(organizationId: string) {
    const startTotal = Date.now();

    // Check cache first
    const cached = this.connectionCache.get(organizationId);
    if (cached) {
      console.log(
        `[TenantManager] ✅ CACHE HIT for ${organizationId} (${Date.now() - startTotal}ms)`,
      );
      return cached.db;
    }

    console.log(`[TenantManager] ❌ CACHE MISS for ${organizationId}`);

    // Cache miss - fetch tenant info and create connection
    const startQuery = Date.now();
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);
    console.log(`[TenantManager] Catalog query: ${Date.now() - startQuery}ms`);

    const tenantRecord = result[0];

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

    // Create new connection with pooling
    const startConnect = Date.now();
    const client = postgres(tenantRecord.connectionString, {
      max: 10, // Pool size for better concurrency
      idle_timeout: 300, // Keep connections alive for 5 minutes (was 20s)
      connect_timeout: 10, // Connection timeout
      max_lifetime: 60 * 30, // Max connection lifetime: 30 minutes
      prepare: false,
    });

    const db = drizzle(client);
    console.log(
      `[TenantManager] Connection created: ${Date.now() - startConnect}ms`,
    );

    // Cache the connection
    this.connectionCache.set(organizationId, {
      client,
      db,
      connectionString: tenantRecord.connectionString,
    });

    console.log(
      `[TenantManager] ⏱️  TOTAL getConnection: ${Date.now() - startTotal}ms`,
    );
    return db;
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

    // Invalidate cache if tenant is no longer active
    if (status !== "active" && tenantRecord) {
      const cached = this.connectionCache.get(tenantRecord.organizationId);
      if (cached) {
        await cached.client.end();
        this.connectionCache.delete(tenantRecord.organizationId);
      }
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

    // Invalidate cache
    const cached = this.connectionCache.get(organizationId);
    if (cached) {
      await cached.client.end();
      this.connectionCache.delete(organizationId);
    }

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

    // Invalidate cache
    const cached = this.connectionCache.get(organizationId);
    if (cached) {
      await cached.client.end();
      this.connectionCache.delete(organizationId);
    }

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
    // Close all cached tenant connections
    for (const [orgId, cached] of this.connectionCache.entries()) {
      await cached.client.end();
      this.connectionCache.delete(orgId);
    }

    await this.catalogClient.end();
    await this.activityLogger.close();
  }
}
