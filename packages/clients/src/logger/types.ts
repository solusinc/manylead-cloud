import type { Logger as PinoLogger, LoggerOptions } from "pino";

export type Logger = PinoLogger;
export type { LoggerOptions };

export interface CreateLoggerOptions {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  component?: string;
  config?: LoggerOptions;
}
