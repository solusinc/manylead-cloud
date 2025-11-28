import Redis from "ioredis";
import { getRedisConfig } from "./config";
import type { CreateRedisClientOptions } from "./types";

// Singleton instances (keyed by connection string for multi-tenant support)
const redisClients = new Map<string, Redis>();

/**
 * Create or retrieve Redis client singleton
 *
 * Pattern: Lazy-initialized singleton with module-level cache
 * Based on: apps/server/src/libs/cache/redis.ts, apps/worker/src/libs/cache/redis.ts
 *
 * @example
 * ```typescript
 * import { createRedisClient } from "@manylead/clients/redis";
 * import { createLogger } from "@manylead/clients/logger";
 *
 * const logger = createLogger({ component: "MyService" });
 * const redis = createRedisClient({
 *   url: env.REDIS_URL,
 *   preset: "queue",
 *   logger,
 * });
 * ```
 */
export function createRedisClient(
  options: CreateRedisClientOptions,
): Redis {
  const { url, preset = "default", config = {}, logger } = options;

  if (!url) {
    throw new Error(
      "Redis URL is required. Provide via options.url or REDIS_URL env var.",
    );
  }

  // Return existing client if available (singleton pattern)
  const existingClient = redisClients.get(url);
  if (existingClient) {
    return existingClient;
  }

  // Get preset configuration
  const baseConfig = getRedisConfig(preset);

  // Create new client
  const client = new Redis(url, {
    ...baseConfig,
    ...config, // Allow overrides
  });

  // Event listeners with optional structured logging
  if (logger) {
    client.on("connect", () => {
      logger.info("Redis connected");
    });

    client.on("error", (err) => {
      logger.error({ err }, "Redis error");
    });

    client.on("close", () => {
      logger.warn("Redis connection closed");
    });
  } else {
    // Fallback to console for critical errors
    client.on("error", (error) => {
      console.error("[Redis] Connection error:", error);
    });
  }

  // Cache the client
  redisClients.set(url, client);

  return client;
}

/**
 * Close specific Redis client or all clients
 *
 * @example
 * ```typescript
 * // Close specific client
 * await closeRedis(env.REDIS_URL);
 *
 * // Close all clients
 * await closeRedis();
 * ```
 */
export async function closeRedis(url?: string): Promise<void> {
  if (url) {
    const client = redisClients.get(url);
    if (client) {
      await client.quit();
      redisClients.delete(url);
    }
  } else {
    // Close all clients
    await Promise.all(
      Array.from(redisClients.values()).map((client) => client.quit()),
    );
    redisClients.clear();
  }
}

/**
 * Get existing Redis client (throws if not created)
 *
 * @example
 * ```typescript
 * const redis = getRedisClient(env.REDIS_URL);
 * ```
 */
export function getRedisClient(url: string): Redis {
  const client = redisClients.get(url);
  if (!client) {
    throw new Error(
      `Redis client not initialized for URL: ${url}. Call createRedisClient() first.`,
    );
  }
  return client;
}

export type { Redis, RedisOptions } from "ioredis";
export * from "./config";
export * from "./types";
