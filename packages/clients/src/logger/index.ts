import pino from "pino";
import type { Logger, CreateLoggerOptions } from "./types";

let rootLogger: Logger | null = null;

/**
 * Create or retrieve root logger singleton
 *
 * Pattern: Singleton with environment-aware configuration
 * Based on: apps/server/src/libs/utils/logger.ts, apps/worker/src/libs/utils/logger.ts
 *
 * @example
 * ```typescript
 * import { createLogger } from "@manylead/clients/logger";
 *
 * // Root logger
 * const logger = createLogger({ level: "info", pretty: true });
 *
 * // Component logger
 * const componentLogger = createLogger({ component: "MyService" });
 * componentLogger.info({ data: "value" }, "Message");
 * ```
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const {
    level = process.env.NODE_ENV === "production" ? "info" : "debug",
    component,
    config = {},
  } = options;

  // Return existing root logger if no component specified
  if (!component && rootLogger) {
    return rootLogger;
  }

  // Create root logger if needed (JSON logging - no pino-pretty to avoid worker thread issues in Next.js)
  rootLogger ??= pino({
      level,
      ...config,
    });

  // Return child logger if component specified
  if (component) {
    return rootLogger.child({ component });
  }

  return rootLogger;
}

/**
 * Get existing root logger (auto-creates with defaults if not exists)
 *
 * @example
 * ```typescript
 * import { getLogger } from "@manylead/clients/logger";
 *
 * const logger = getLogger();
 * logger.info("message");
 * ```
 */
export function getLogger(): Logger {
  if (!rootLogger) {
    // Auto-create with defaults
    return createLogger();
  }
  return rootLogger;
}

export type { Logger, LoggerOptions } from "./types";
export * from "./types";
