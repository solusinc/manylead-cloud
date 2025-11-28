import type { RedisOptions } from "ioredis";
import type { RedisConfigPreset } from "./types";

/**
 * Redis configuration presets
 * Consolidates patterns from:
 * - packages/tenant-db/src/tenant-manager.ts (lines 71-81)
 * - packages/shared/src/socket/publish.ts (lines 54-62)
 * - packages/api/src/libs/queue/redis.ts (lines 10-20)
 * - apps/server/src/libs/cache/redis.ts (lines 9-23)
 * - apps/worker/src/libs/cache/redis.ts (lines 9-24)
 */
export function getRedisConfig(preset: RedisConfigPreset): RedisOptions {
  const baseConfig: RedisOptions = {
    lazyConnect: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  switch (preset) {
    case "queue":
      // BullMQ-specific configuration
      return {
        ...baseConfig,
        maxRetriesPerRequest: null, // Required for BullMQ blocking commands
        enableAutoPipelining: true,
        keepAlive: 30000,
        connectTimeout: 10000,
      };

    case "pubsub":
      // Pub/Sub optimized (from packages/shared/src/socket/publish.ts)
      return {
        ...baseConfig,
        enableAutoPipelining: true,
      };

    case "cache":
      // Caching optimized
      return {
        ...baseConfig,
        enableAutoPipelining: true,
        keepAlive: 30000,
      };

    case "high-latency":
      // High-latency network optimization (from tenant-db)
      return {
        ...baseConfig,
        maxRetriesPerRequest: null,
        enableAutoPipelining: true, // CRITICAL: Batches commands automatically
        keepAlive: 30000, // Keep TCP connection alive
        connectTimeout: 10000,
      };

    case "default":
    default:
      return baseConfig;
  }
}
