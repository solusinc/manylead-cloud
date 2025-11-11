import type { Config } from "drizzle-kit";

import { env } from "./src/env";

// Use DATABASE_URL_DIRECT for migrations (direct connection to PostgreSQL)
// Drizzle Kit needs direct access, not via PgBouncer

export default {
  schema: "./src/schema/catalog/index.ts",
  out: "./drizzle/catalog",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_URL_DIRECT },
  casing: "snake_case",

  // Ignore tables created by PostgreSQL extensions
  tablesFilter: ["!part_config*", "!table_privs"],

  // Only manage tables in the public schema
  schemaFilter: ["public"],

  // Strict mode for safer migrations
  strict: true,
} satisfies Config;
