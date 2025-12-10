/**
 * Bright Data Environment Variables
 */

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // API Token para Account Management API (adicionar IPs, etc)
    // Obter em: https://brightdata.com/cp/setting/users
    BRIGHT_DATA_API_TOKEN: z.string().min(1),
  },
  runtimeEnv: {
    BRIGHT_DATA_API_TOKEN: process.env.BRIGHT_DATA_API_TOKEN,
  },
});
