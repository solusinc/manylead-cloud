import type { Config } from "drizzle-kit";

import { env } from "./src/env";

export default {
  schema: "../db/src/schema/tenant/index.ts",
  out: "./drizzle/tenant",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL_DIRECT },
  casing: "snake_case",
  strict: true,
} satisfies Config;
