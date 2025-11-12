import Redis from "ioredis";
import { env } from "~/env";
import { logger } from "~/libs/utils/logger";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires null for blocking commands
      lazyConnect: false, // Connect immediately
      enableAutoPipelining: true, // CRITICAL: Batches commands automatically for low latency
      keepAlive: 30000, // Keep TCP connection alive for 30 seconds
      connectTimeout: 10000, // 10 second timeout for initial connection
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        logger.error({ err }, "Redis connection error");
        return true;
      },
    });

    redisClient.on("connect", () => {
      logger.info("Redis connected");
    });

    redisClient.on("error", (err) => {
      logger.error({ err }, "Redis error");
    });

    redisClient.on("close", () => {
      logger.warn("Redis connection closed");
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed gracefully");
  }
}
