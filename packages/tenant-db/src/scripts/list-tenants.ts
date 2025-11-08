import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";

import { tenant } from "@manylead/db";

async function main() {
  const args = process.argv.slice(2);

  const statusArg = args.find((arg) => arg.startsWith("--status="));
  const statusFilter = statusArg?.split("=")[1] as
    | "provisioning"
    | "active"
    | "suspended"
    | "deleted"
    | "failed"
    | undefined;

  const formatArg = args.find((arg) => arg.startsWith("--format="));
  const format = formatArg?.split("=")[1] ?? "table";

  const connString = process.env.DATABASE_URL_DIRECT;

  if (!connString) {
    console.error("Missing DATABASE_URL_DIRECT");
    process.exit(1);
  }

  const client = postgres(connString, { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    const tenants = statusFilter
      ? await db.select().from(tenant).where(eq(tenant.status, statusFilter))
      : await db.select().from(tenant);

    if (format === "json") {
      console.log(JSON.stringify(tenants, null, 2));
    } else {
      console.log("");
      console.log(`📋 Tenants (${tenants.length} total)`);
      console.log("");

      if (tenants.length === 0) {
        console.log("   No tenants found");
        console.log("");
      } else {
        tenants.forEach((t) => {
          const statusIcon =
            t.status === "active"
              ? "✅"
              : t.status === "provisioning"
                ? "⏳"
                : t.status === "failed"
                  ? "❌"
                  : "⏸️";

          console.log(`${statusIcon} ${t.slug}`);
          console.log(`   Name: ${t.name}`);
          console.log(`   ID: ${t.id}`);
          console.log(`   Database: ${t.databaseName}`);
          console.log(`   Host: ${t.host}:${t.port}`);
          console.log(`   Region: ${t.region ?? "N/A"}`);
          console.log(`   Tier: ${t.tier}`);
          console.log(`   Status: ${t.status}`);
          console.log(
            `   Created: ${t.createdAt.toISOString().split("T")[0]}`,
          );
          console.log("");
        });
      }
    }

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to list tenants");
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

void main();
