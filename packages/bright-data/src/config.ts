/**
 * Bright Data Configuration
 *
 * Structured configuration objects built from validated environment variables.
 */

import type { BrightDataConnection } from "./types";
import { env } from "./env";

/**
 * Bright Data connection configuration
 */
export const BRIGHT_DATA_CONFIG: BrightDataConnection = {
  customerId: env.BRIGHT_DATA_CUSTOMER_ID,
  zone: env.BRIGHT_DATA_ZONE,
  password: env.BRIGHT_DATA_PASSWORD,
  host: env.BRIGHT_DATA_HOST,
  port: env.BRIGHT_DATA_PORT,
};

/**
 * Session keep-alive configuration
 */
export const KEEPALIVE_CONFIG = {
  intervalMs: env.BRIGHT_DATA_KEEPALIVE_INTERVAL_MS,
  sessionTimeoutMs: env.BRIGHT_DATA_SESSION_TIMEOUT_MS,
} as const;
