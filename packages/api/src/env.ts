import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    RESEND_API_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.url(),
    REDIS_URL: z.url(),
    WEBHOOK_BASE_URL: z.url(),
    EVOLUTION_API_URL: z.url(),
    EVOLUTION_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    REDIS_URL: process.env.REDIS_URL,
    WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
  },
});
