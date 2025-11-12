import { drizzle } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import postgres from "postgres";

import { organization } from "@manylead/db";
import { TenantDatabaseManager } from "../tenant-manager";

/**
 * Script para criar tenant manualmente
 *
 * Agora que usamos Better Auth, precisamos:
 * 1. Criar a organization no catalog DB (Better Auth usa nanoid)
 * 2. Provisionar o tenant database
 *
 * IMPORTANTE: Em produção, isso é feito automaticamente via Better Auth hooks!
 * Este script é apenas para testes/desenvolvimento.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: pnpm create-tenant <slug> <name> [--tier=shared]");
    console.error(
      "Example: pnpm create-tenant acme-corp 'Acme Corporation' --tier=dedicated",
    );
    process.exit(1);
  }

  const slug = args[0];
  const name = args[1];

  if (!slug || !name) {
    console.error("❌ Slug and name are required");
    process.exit(1);
  }

  const tierArg = args.find((arg) => arg.startsWith("--tier="));
  const tier = tierArg?.split("=")[1] as
    | "shared"
    | "dedicated"
    | "enterprise"
    | undefined;

  console.log("🚀 Creating new tenant...");
  console.log(`   Slug: ${slug}`);
  console.log(`   Name: ${name}`);
  console.log(`   Tier: ${tier ?? "shared"}`);
  console.log("");

  const connString = process.env.DATABASE_URL_DIRECT;

  if (!connString) {
    console.error("❌ Missing DATABASE_URL_DIRECT");
    process.exit(1);
  }

  const catalogClient = postgres(connString, { max: 1, prepare: false });
  const catalogDb = drizzle(catalogClient);
  const manager = new TenantDatabaseManager();

  try {
    // Step 1: Criar organization no catalog (Better Auth)
    console.log("📝 Step 1/2: Creating organization in catalog DB...");

    const organizationId = nanoid(); // Better Auth usa nanoid, não UUID!

    const [org] = await catalogDb
      .insert(organization)
      .values({
        id: organizationId,
        name,
        slug,
        createdAt: new Date(),
      })
      .returning();

    if (!org) {
      throw new Error("Failed to create organization");
    }

    console.log(`   ✅ Organization created: ${org.id}`);
    console.log("");

    // Step 2: Provisionar tenant database (async + complete)
    console.log("🏗️  Step 2/2: Provisioning tenant database...");

    // Criar tenant record
    await manager.provisionTenantAsync({
      organizationId: org.id,
      slug: org.slug,
      name: org.name,
      tier,
    });

    // Completar o provisioning físico (CREATE DATABASE + migrations)
    const tenant = await manager.completeTenantProvisioning(org.id);

    console.log("   ✅ Tenant database provisioned!");
    console.log("");

    console.log("✅ Tenant created successfully!");
    console.log("");
    console.log("Details:");
    console.log(`   Organization ID: ${org.id} (nanoid)`);
    console.log(`   Tenant ID: ${tenant.id} (uuid)`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   Database: ${tenant.databaseName}`);
    console.log(`   Host: ${tenant.host}:${tenant.port}`);
    console.log(`   Region: ${tenant.region}`);
    console.log(`   Status: ${tenant.status}`);
    console.log("");
    console.log(
      "💡 Note: In production, this happens automatically via Better Auth hooks!",
    );
    console.log("");

    await catalogClient.end();
    await manager.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create tenant");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(error);
    }
    await catalogClient.end();
    await manager.close();
    process.exit(1);
  }
}

void main();
