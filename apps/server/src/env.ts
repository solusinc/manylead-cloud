import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),

    // Server
    SERVER_PORT: z.coerce.number().default(3002),

    // Database (Catalog)
    DATABASE_URL: z.string().url(),
    DATABASE_URL_DIRECT: z.string().url(),

    // PostgreSQL Admin (for tenant provisioning)
    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),

    // Redis
    REDIS_URL: z.string().url(),

    // Queue Names
    QUEUE_TENANT_PROVISIONING: z.string().default("tenant-provisioning"),
    QUEUE_TENANT_MIGRATION: z.string().default("tenant-migration"),

    // Socket.io
    SOCKET_IO_CORS_ORIGIN: z.string(),

    // Sentry (optional)
    SENTRY_DSN: z.string().optional(),

    // Better Auth
    BETTER_AUTH_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
  },

  /**
   * What object holds the environment variables at runtime.
   */
  runtimeEnv: process.env,

  /**
   * Skip validation on build time
   */
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
