import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL_DIRECT: z.string().url(),
    POSTGRES_USER: z.string().default("postgres"),
    POSTGRES_PASSWORD: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: {
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    NODE_ENV: process.env.NODE_ENV,
  },
});
