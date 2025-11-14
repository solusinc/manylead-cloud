import type { Hono } from "hono";
import { getRedisClient } from "~/libs/cache/redis";

/**
 * GET /v1/health
 * Health check endpoint
 */
export function registerGetHealth(app: Hono) {
  return app.get("/", async (c) => {
    const redis = getRedisClient();

    // Check Redis connectivity
    let redisStatus = "healthy";
    try {
      await redis.ping();
    } catch {
      redisStatus = "unhealthy";
    }

    const health = {
      status: redisStatus === "healthy" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
      },
    };

    return c.json(health);
  });
}
