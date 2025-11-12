import type { Context } from "hono";
import { ZodError } from "zod/v4";
import {
  TenantDatabaseError,
  TenantNotActiveError,
  TenantNotFoundError,
  TenantProvisioningError,
} from "./tenant";

export * from "./tenant";

/**
 * Global error handler for Hono
 */
export function handleError(err: Error, c: Context) {
  console.error("Error:", err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation Error",
        issues: err.issues,
      },
      400,
    );
  }

  // Tenant-specific errors
  if (err instanceof TenantNotFoundError) {
    return c.json(
      {
        error: err.message,
      },
      404,
    );
  }

  if (err instanceof TenantNotActiveError) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      503, // Service Unavailable
    );
  }

  if (
    err instanceof TenantProvisioningError ||
    err instanceof TenantDatabaseError
  ) {
    return c.json(
      {
        error: err.message,
        cause: err.cause?.message,
      },
      500,
    );
  }

  // Generic server error
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500,
  );
}

/**
 * Error response helper
 */
export function errorResponse(
  c: Context,
  message: string,
  status: 400 | 401 | 403 | 404 | 500 | 503 = 500,
) {
  return c.json({ error: message }, status);
}
