import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Redis
    REDIS_URL: z.string().url(),

    // PostgreSQL
    DATABASE_URL: z.string().url(),
    DATABASE_URL_DIRECT: z.string().url(),
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),

    // Cloudflare R2
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PUBLIC_URL: z.string().url().optional(),

    // Evolution API
    EVOLUTION_API_URL: z.string().url().optional(),
    EVOLUTION_API_KEY: z.string().min(1).optional(),

    // Environment
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
