import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL_DIRECT: z.string().url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: {
    DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
    NODE_ENV: process.env.NODE_ENV,
  },
});
