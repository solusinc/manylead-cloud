import type { Config } from "drizzle-kit";

import { env } from "./src/env";

// Tenant database configuration
// This config is used to generate migrations for tenant databases
// Note: Migrations will be applied to each tenant database individually

export default {
	schema: "./src/schema/tenant/index.ts",
	out: "./drizzle/tenant",
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
