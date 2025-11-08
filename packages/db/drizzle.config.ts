import type { Config } from "drizzle-kit";

// Use DATABASE_URL_DIRECT for migrations (direct connection to PostgreSQL)
// Drizzle Kit needs direct access, not via PgBouncer
if (!process.env.DATABASE_URL_DIRECT) {
  throw new Error("Missing DATABASE_URL_DIRECT");
}

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_DIRECT },
  casing: "snake_case",

  // Ignore tables created by PostgreSQL extensions
  tablesFilter: ["!part_config*", "!table_privs"],

  // Only manage tables in the public schema
  schemaFilter: ["public"],
} satisfies Config;
