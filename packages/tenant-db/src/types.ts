import type { Tenant } from "@manylead/db";

export interface ProvisionTenantParams {
  organizationId: string;
  slug: string;
  name: string;
  databaseHostId?: string;
  tier?: "shared" | "dedicated" | "enterprise";
  metadata?: Record<string, unknown>;
}

export interface MigrateAllOptions {
  parallel?: boolean;
  maxConcurrency?: number;
  continueOnError?: boolean;
}

export interface MigrationResult {
  tenantId: string;
  slug: string;
  success: boolean;
  duration: number;
  error?: string;
}

export interface HealthCheckResult {
  tenantId: string;
  slug: string;
  status: "healthy" | "unhealthy";
  canConnect: boolean;
  databaseExists: boolean;
  schemaVersion?: string;
  error?: string;
}

export interface ActivityLogParams {
  tenantId?: string;
  action: string;
  category: "tenant" | "migration" | "user" | "system" | "security";
  severity?: "info" | "warning" | "error" | "critical";
  description: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectionParams {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export type { Tenant };
