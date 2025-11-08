import type { Config } from "drizzle-kit";

// Use DATABASE_URL_DIRECT for migrations (direct connection)
// Use DATABASE_URL for runtime queries (via PgBouncer)
if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL_DIRECT");
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  casing: "snake_case",
} satisfies Config;
