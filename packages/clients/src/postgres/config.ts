import type { PostgresOptions, PostgresConfigPreset } from "./types";

/**
 * Postgres configuration presets
 * Consolidates patterns from:
 * - packages/tenant-db/src/tenant-manager.ts (lines 54-60, 295, 303-306, 400-406, 450-453)
 */
export function getPostgresConfig(
  preset: PostgresConfigPreset,
): PostgresOptions {
  const baseConfig: PostgresOptions = {
    connect_timeout: 10,
  };

  switch (preset) {
    case "pgbouncer":
      // PgBouncer transaction mode (from tenant-db lines 54-60)
      return {
        ...baseConfig,
        max: 3, // Small pool - PgBouncer handles the real pooling
        idle_timeout: 20, // Short timeout - PgBouncer manages lifecycle
        max_lifetime: null, // No limit - let PgBouncer recycle connections
        prepare: false, // Required for PgBouncer transaction mode
      };

    case "admin":
      // Admin operations (from tenant-db line 295)
      return {
        ...baseConfig,
        max: 1,
      };

    case "migration":
      // Migration operations (from tenant-db lines 303-306, 450-453)
      return {
        ...baseConfig,
        max: 1,
        prepare: false,
      };

    case "small-pool":
      // Small connection pool (from tenant-db lines 400-406)
      return {
        ...baseConfig,
        max: 2,
        idle_timeout: 20,
        max_lifetime: null,
        prepare: false,
      };

    case "default":
    default:
      return {
        ...baseConfig,
        max: 10,
        idle_timeout: 60,
      };
  }
}
