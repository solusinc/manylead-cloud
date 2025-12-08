/**
 * Bright Data Environment Variables
 *
 * Validates environment variables for Bright Data proxy integration.
 */

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Required Bright Data credentials
    BRIGHT_DATA_CUSTOMER_ID: z.string().min(1, "Bright Data Customer ID is required"),
    BRIGHT_DATA_ZONE: z.string().min(1, "Bright Data Zone name is required"),
    BRIGHT_DATA_PASSWORD: z.string().min(1, "Bright Data Zone password is required"),

    // Optional overrides
    BRIGHT_DATA_HOST: z.string().default("brd.superproxy.io"),
    BRIGHT_DATA_PORT: z.coerce.number().default(33335),
    BRIGHT_DATA_PROTOCOL: z.enum(["http", "https", "socks5"]).default("http"),

    // Keep-alive configuration
    BRIGHT_DATA_KEEPALIVE_INTERVAL_MS: z.coerce.number().default(300000), // 5 minutes
    BRIGHT_DATA_SESSION_TIMEOUT_MS: z.coerce.number().default(420000),    // 7 minutes
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
