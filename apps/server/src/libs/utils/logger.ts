import pino from "pino";
import { env } from "~/env";

/**
 * Structured logger using Pino
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
            translateTime: "HH:MM:ss",
          },
        }
      : undefined,
});

/**
 * Create a child logger with component context
 *
 * Usage:
 * ```ts
 * const log = createLogger("SocketManager");
 * log.info("Server started");
 * log.error({ err }, "Failed to connect");
 * ```
 */
export function createLogger(component: string) {
  return logger.child({ component });
}
