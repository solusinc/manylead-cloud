import type { Context, Next } from "hono";
import { logger } from "~/libs/utils/logger";

/**
 * Logging middleware
 * Logs all incoming requests with duration
 */
export async function loggingMiddleware(c: Context, next: Next) {
  const requestId = c.get("requestId") || "unknown";
  const startTime = Date.now();

  logger.info({
    msg: "Request started",
    requestId,
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("User-Agent"),
  });

  await next();

  const duration = Date.now() - startTime;

  logger.info({
    msg: "Request completed",
    requestId,
    status: c.res.status,
    duration,
  });
}
