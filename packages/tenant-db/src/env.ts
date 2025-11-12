import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DATABASE_URL_DIRECT: z.string().url(),
    POSTGRES_USER: z.string().default("postgres"),
    POSTGRES_PASSWORD: z.string().min(1),
    REDIS_URL: z.string().url(),
    QUEUE_TENANT_PROVISIONING: z.string().default("tenant-provisioning"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    REDIS_URL: process.env.REDIS_URL,
    QUEUE_TENANT_PROVISIONING: process.env.QUEUE_TENANT_PROVISIONING,
    NODE_ENV: process.env.NODE_ENV,
  },
});
