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
    QUEUE_CHANNEL_SYNC: z.string().default("channel-sync"),

    // Socket.io
    SOCKET_IO_CORS_ORIGIN: z.string(),

    // Sentry (optional)
    SENTRY_DSN: z.string().optional(),

    // Better Auth
    BETTER_AUTH_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),

    // Evolution API
    EVOLUTION_API_URL: z.string().url(),
    EVOLUTION_API_KEY: z.string().min(1),
    WEBHOOK_BASE_URL: z.string().url(),
  },

  /**
   * What object holds the environment variables at runtime.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SERVER_PORT: process.env.SERVER_PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    REDIS_URL: process.env.REDIS_URL,
    QUEUE_TENANT_PROVISIONING: process.env.QUEUE_TENANT_PROVISIONING,
    QUEUE_TENANT_MIGRATION: process.env.QUEUE_TENANT_MIGRATION,
    SOCKET_IO_CORS_ORIGIN: process.env.SOCKET_IO_CORS_ORIGIN,
    SENTRY_DSN: process.env.SENTRY_DSN,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
  },

  /**
   * Skip validation on build time
   */
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
