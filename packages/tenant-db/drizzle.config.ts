import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL_DIRECT) {
  throw new Error("Missing DATABASE_URL_DIRECT");
}

export default {
  schema: "../db/src/schema/tenant/index.ts",
  out: "./drizzle/tenant",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT },
  casing: "snake_case",
  strict: true,
} satisfies Config;
