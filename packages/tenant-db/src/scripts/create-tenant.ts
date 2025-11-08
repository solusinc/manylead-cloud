import { v4 as uuidv4 } from "uuid";
import { TenantDatabaseManager } from "../tenant-manager";

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

  const manager = new TenantDatabaseManager();

  try {
    const organizationId = uuidv4();

    const tenant = await manager.provisionTenant({
      organizationId,
      slug,
      name,
      tier,
    });

    console.log("✅ Tenant created successfully!");
    console.log("");
    console.log("Details:");
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Organization ID: ${tenant.organizationId}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   Database: ${tenant.databaseName}`);
    console.log(`   Host: ${tenant.host}:${tenant.port}`);
    console.log(`   Region: ${tenant.region}`);
    console.log(`   Status: ${tenant.status}`);
    console.log("");

    await manager.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to create tenant");
    console.error(error);
    await manager.close();
    process.exit(1);
  }
}

void main();
