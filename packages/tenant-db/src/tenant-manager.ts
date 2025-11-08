import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as catalogSchema from "@manylead/db";

import { databaseHost, tenant } from "@manylead/db";
import type { Tenant } from "@manylead/db";

import { ActivityLogger } from "./activity-logger";
import {
  buildConnectionString,
  generateDatabaseName,
  isValidSlug,
  retryWithBackoff,
} from "./utils";
import type {
  HealthCheckResult,
  MigrateAllOptions,
  MigrationResult,
  ProvisionTenantParams,
} from "./types";

export class TenantDatabaseManager {
  private catalogDb;
  private catalogClient;
  private activityLogger: ActivityLogger;

  constructor(catalogConnectionString?: string) {
    const connString =
      catalogConnectionString ?? process.env.DATABASE_URL_DIRECT;

    if (!connString) {
      throw new Error("Missing catalog database connection string");
    }

    this.catalogClient = postgres(connString, {
      max: 5,
      prepare: false,
    });

    this.catalogDb = drizzle(this.catalogClient, { schema: catalogSchema });
    this.activityLogger = new ActivityLogger(connString);
  }

  async provisionTenant(params: ProvisionTenantParams): Promise<Tenant> {
    const startTime = Date.now();

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

    const postgresUser = process.env.POSTGRES_USER ?? "postgres";
    const postgresPassword = process.env.POSTGRES_PASSWORD;

    if (!postgresPassword) {
      throw new Error("Missing POSTGRES_PASSWORD");
    }

    const connectionString = buildConnectionString({
      host: host.host,
      port: host.port,
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

      // TODO FASE-2: Rodar migrations quando tiver schema tenant
      // const tenantDb = drizzle(tenantClient);
      // await migrate(tenantDb, { migrationsFolder: "drizzle/tenant" });

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
    const result = await this.catalogDb
      .select()
      .from(tenant)
      .where(eq(tenant.organizationId, organizationId))
      .limit(1);

    const tenantRecord = result[0];

    if (!tenantRecord) {
      throw new Error(`Tenant not found: ${organizationId}`);
    }

    if (tenantRecord.status !== "active") {
      throw new Error(
        `Tenant is not active: ${tenantRecord.slug} (status: ${tenantRecord.status})`,
      );
    }

    const client = postgres(tenantRecord.connectionString, {
      max: 3,
      prepare: false,
    });

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
      await migrate(db, { migrationsFolder: "drizzle/tenant" });
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
        schemaVersion: typeof tenantRecord.metadata?.schemaVersion === "string"
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
    await this.catalogDb
      .update(tenant)
      .set({ status })
      .where(eq(tenant.id, tenantId));
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

    const postgresUser = process.env.POSTGRES_USER;
    const postgresPassword = process.env.POSTGRES_PASSWORD;

    if (!postgresUser || !postgresPassword) {
      throw new Error("Missing POSTGRES_USER or POSTGRES_PASSWORD");
    }

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
    await this.catalogClient.end();
    await this.activityLogger.close();
  }
}
