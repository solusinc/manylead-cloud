import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    ENCRYPTION_KEY: z
      .string()
      .min(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)")
      .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)")
      .regex(/^[0-9a-f]{64}$/i, "ENCRYPTION_KEY must be a valid hex string"),
  },
  runtimeEnv: {
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  },
});
