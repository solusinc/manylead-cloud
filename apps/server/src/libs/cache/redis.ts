import type Redis from "ioredis";
import { createRedisClient } from "@manylead/clients/redis";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";

const logger = createLogger("Server:Redis");

/**
 * Redis client singleton
 * Used for both caching and pub/sub
 */
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  redisClient ??= createRedisClient({
    url: env.REDIS_URL,
    preset: "queue",
    logger,
  });

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
