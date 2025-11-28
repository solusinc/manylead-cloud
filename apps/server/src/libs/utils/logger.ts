import pino from "pino";
import { env } from "~/env";

// Root logger with pino-pretty for server (readable logs in development)
const rootLogger = pino({
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

export const logger = rootLogger.child({ component: "Server" });

export function createLogger(component: string) {
  return rootLogger.child({ component });
}
