import type { Context, Next } from "hono";
import { errorResponse } from "~/libs/errors";

/**
 * Auth middleware (placeholder)
 * TODO: Integrate with Better Auth when needed
 */
export async function authMiddleware(c: Context, next: Next) {
  // For now, just pass through
  // In the future, validate Better Auth session here
  await next();
}

/**
 * API Key auth middleware (for webhooks)
 */
export async function apiKeyMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header("x-api-key");

  if (!apiKey) {
    return errorResponse(c, "Missing API key", 401);
  }

  // TODO: Validate API key against database
  // For now, just pass through
  await next();
}
