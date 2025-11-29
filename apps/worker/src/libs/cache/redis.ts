import type Redis from "ioredis";
import { createRedisClient } from "@manylead/clients/redis";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";

const logger = createLogger("Worker:Redis");

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  redisClient ??= createRedisClient({
    url: env.REDIS_URL,
    preset: "queue",
    logger,
  });

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis connection closed gracefully");
  }
}
