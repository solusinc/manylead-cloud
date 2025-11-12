import Redis from "ioredis";
import { env } from "~/env";
import { logger } from "~/libs/utils/logger";

/**
 * Redis client singleton
 * Used for both caching and pub/sub
 */
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires null for blocking commands
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
  }

  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed");
  }
}
