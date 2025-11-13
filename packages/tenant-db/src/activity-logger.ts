import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { activityLog } from "@manylead/db";
import type { ActivityLogParams } from "./types";

export class ActivityLogger {
  private catalogDb;

  constructor(catalogConnectionString?: string) {
    const connString =
      catalogConnectionString ?? process.env.DATABASE_URL_DIRECT;

    if (!connString) {
      throw new Error("Missing catalog database connection string");
    }

    const client = postgres(connString, {
      max: 2,
      prepare: false,
    });

    this.catalogDb = drizzle(client);
  }

  async log(params: ActivityLogParams): Promise<void> {
    try {
      await this.catalogDb.insert(activityLog).values({
        tenantId: params.tenantId,
        action: params.action,
        category: params.category,
        severity: params.severity ?? "info",
        description: params.description,
        metadata: params.metadata,
      });
    } catch (error) {
      console.error("[ActivityLogger] Failed to log activity:", error);
    }
  }

  async logTenantCreated(
    tenantId: string,
    slug: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "tenant.created",
      category: "tenant",
      severity: "info",
      description: `Tenant ${slug} created`,
      metadata,
    });
  }

  async logTenantProvisioned(
    tenantId: string,
    databaseName: string,
    duration: number,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "tenant.provisioned",
      category: "tenant",
      severity: "info",
      description: `Tenant database ${databaseName} provisioned successfully`,
      metadata: { databaseName, durationMs: duration },
    });
  }

  async logTenantDeleted(
    tenantId: string,
    slug: string,
    userId?: string,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "tenant.deleted",
      category: "tenant",
      severity: "warning",
      description: `Tenant ${slug} soft deleted`,
      metadata: userId ? { userId } : undefined,
    });
  }

  async logMigrationStarted(
    tenantId: string,
    migrationName: string,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "migration.started",
      category: "migration",
      severity: "info",
      description: `Migration ${migrationName} started`,
      metadata: { migrationName },
    });
  }

  async logMigrationExecuted(
    tenantId: string,
    migrationName: string,
    duration: number,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "migration.executed",
      category: "migration",
      severity: "info",
      description: `Migration ${migrationName} executed successfully`,
      metadata: { migrationName, durationMs: duration },
    });
  }

  async logMigrationFailed(
    tenantId: string,
    migrationName: string,
    error: string,
  ): Promise<void> {
    await this.log({
      tenantId,
      action: "migration.failed",
      category: "migration",
      severity: "error",
      description: `Migration ${migrationName} failed: ${error}`,
      metadata: { migrationName, error },
    });
  }

  async logSystemError(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      action: "system.error",
      category: "system",
      severity: "error",
      description: error.message,
      metadata: {
        error: error.stack,
        ...context,
      },
    });
  }

  async logCriticalError(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      action: "system.critical_error",
      category: "system",
      severity: "critical",
      description: error.message,
      metadata: {
        error: error.stack,
        ...context,
      },
    });
  }

  async close(): Promise<void> {
    // Postgres client cleanup is handled automatically
  }
}
