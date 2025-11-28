import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";
import { env as clientsEnv } from "@manylead/clients/env";

export function authEnv() {
  return createEnv({
    extends: [clientsEnv],
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      AUTH_URL: z.string().url().optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
