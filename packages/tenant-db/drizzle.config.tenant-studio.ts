import type { Config } from "drizzle-kit";

/**
 * Tenant Studio Configuration
 *
 * To use this, set TENANT_DB_NAME env var to the specific tenant database:
 *
 * TENANT_DB_NAME=org_affa9cd64060476b8799cea657125511 pnpm db:studio:tenant
 */

const tenantDbName = process.env.TENANT_DB_NAME;

if (!tenantDbName) {
	throw new Error(
		"Missing TENANT_DB_NAME. Usage: TENANT_DB_NAME=org_xxx pnpm db:studio:tenant"
	);
}

if (!process.env.DATABASE_URL_DIRECT) {
	throw new Error("Missing DATABASE_URL_DIRECT");
}

// Replace database name in connection string
const baseUrl = process.env.DATABASE_URL_DIRECT;
const urlParts = baseUrl.split("/");
urlParts[urlParts.length - 1] = tenantDbName;
const tenantUrl = urlParts.join("/");

console.log(`🎯 Opening Drizzle Studio for tenant: ${tenantDbName}`);

export default {
	schema: "../../packages/db/src/schema/tenant/index.ts",
	out: "./drizzle/tenant",
	dialect: "postgresql",
	dbCredentials: { url: tenantUrl },
	casing: "snake_case",
	tablesFilter: ["!part_config*", "!table_privs"],
	schemaFilter: ["public"],
	strict: true,
} satisfies Config;
