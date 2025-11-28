import { BaseError } from "@manylead/error";

/**
 * Custom error for permission-related issues
 */
export class PermissionError extends BaseError {
  public readonly name = "PermissionError";
  public readonly code = "BAD_REQUEST" as const;

  constructor(message: string, context?: Record<string, unknown>) {
    super({ message, context });
  }
}
