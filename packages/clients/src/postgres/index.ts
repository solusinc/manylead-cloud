import postgres from "postgres";
import { getPostgresConfig } from "./config";
import type { Sql, CreatePostgresClientOptions } from "./types";

// Singleton instances (keyed by connection string)
const postgresClients = new Map<string, Sql>();

/**
 * Create or retrieve Postgres client singleton
 *
 * Pattern: Lazy-initialized singleton with connection pooling
 * Based on: packages/tenant-db/src/tenant-manager.ts (lines 54-60, 400-406)
 *
 * @example
 * ```typescript
 * import { createPostgresClient } from "@manylead/clients/postgres";
 * import { createLogger } from "@manylead/clients/logger";
 *
 * const logger = createLogger({ component: "Database" });
 * const db = createPostgresClient({
 *   connectionString: env.DATABASE_URL,
 *   preset: "pgbouncer",
 *   logger,
 * });
 * ```
 */
export function createPostgresClient(
  options: CreatePostgresClientOptions,
): Sql {
  const { connectionString, preset = "default", config = {}, logger } = options;

  if (!connectionString) {
    throw new Error("Postgres connection string is required");
  }

  // Return existing client if available
  const existingClient = postgresClients.get(connectionString);
  if (existingClient) {
    return existingClient;
  }

  // Get preset configuration
  const baseConfig = getPostgresConfig(preset);

  // Create new client
  const client = postgres(connectionString, {
    ...baseConfig,
    ...config, // Allow overrides
    onnotice: logger
      ? (notice) => logger.debug({ notice }, "Postgres notice")
      : undefined,
  });

  // Cache the client
  postgresClients.set(connectionString, client);

  if (logger) {
    logger.info({ preset }, "Postgres client created");
  }

  return client;
}

/**
 * Close specific Postgres client or all clients
 *
 * @example
 * ```typescript
 * // Close specific client
 * await closePostgres(env.DATABASE_URL);
 *
 * // Close all clients
 * await closePostgres();
 * ```
 */
export async function closePostgres(
  connectionString?: string,
): Promise<void> {
  if (connectionString) {
    const client = postgresClients.get(connectionString);
    if (client) {
      await client.end({ timeout: 5 });
      postgresClients.delete(connectionString);
    }
  } else {
    // Close all clients
    await Promise.all(
      Array.from(postgresClients.values()).map((client) =>
        client.end({ timeout: 5 }),
      ),
    );
    postgresClients.clear();
  }
}

/**
 * Get existing Postgres client (throws if not created)
 *
 * @example
 * ```typescript
 * const db = getPostgresClient(env.DATABASE_URL);
 * ```
 */
export function getPostgresClient(connectionString: string): Sql {
  const client = postgresClients.get(connectionString);
  if (!client) {
    throw new Error(
      `Postgres client not initialized for connection: ${connectionString}. ` +
        `Call createPostgresClient() first.`,
    );
  }
  return client;
}

export type { Sql, PostgresOptions } from "./types";
export * from "./config";
export * from "./types";
