import Redis from "ioredis";
import { env } from "~/env";

/**
 * Shared Redis connection for BullMQ queues
 */
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  redisClient ??= new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    lazyConnect: false,
    enableAutoPipelining: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
