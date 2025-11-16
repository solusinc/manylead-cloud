import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/catalog";

async function main() {
  const databaseUrl = process.env.DATABASE_URL_DIRECT;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL_DIRECT");
  }

  console.log("🌱 Seeding database...");

  const connection = postgres(databaseUrl, { max: 1 });
  const db = drizzle(connection, { schema });

  // Inserir host inicial de produção (Canada)
  const [host] = await db
    .insert(schema.databaseHost)
    .values({
      name: "postgres-ca-primary",
      host: "148.113.164.109",
      port: 5454,
      region: "ca-toronto",
      tier: "shared",
      maxTenants: 70,
      diskCapacityGb: 500,
      isDefault: true,
      status: "active",
      capabilities: {
        pgVersion: "16",
        extensions: ["timescaledb", "pg_cron", "vector"],
        features: ["full-text-search", "pgbouncer"],
      },
    })
    .returning();

  console.log("✅ Host inicial criado:", host);

  await connection.end();

  console.log("✅ Seed completed successfully");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Seed failed");
  console.error(error);
  process.exit(1);
});
