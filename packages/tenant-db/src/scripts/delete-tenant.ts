import { TenantDatabaseManager } from "../tenant-manager";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: pnpm delete-tenant <slug-or-id>");
    console.error("Example: pnpm delete-tenant acme-corp");
    process.exit(1);
  }

  const identifier = args[0];

  if (!identifier) {
    console.error("❌ Tenant identifier is required");
    process.exit(1);
  }

  const forceArg = args.find((arg) => arg === "--force");
  const force = !!forceArg;

  console.log("🗑️  Deleting tenant...");
  console.log(`   Identifier: ${identifier}`);
  console.log(`   Force: ${force}`);
  console.log("");

  const manager = new TenantDatabaseManager();

  try {
    let tenant = await manager.getTenantBySlug(identifier);
    tenant ??= await manager.getTenantById(identifier);

    if (!tenant) {
      console.error(`❌ Tenant not found: ${identifier}`);
      await manager.close();
      process.exit(1);
    }

    if (!force) {
      console.log("⚠️  WARNING: This will soft delete the tenant:");
      console.log(`   - Tenant: ${tenant.name} (${tenant.slug})`);
      console.log(`   - Status will be marked as 'deleted'`);
      console.log(`   - Database will be kept (can be recovered)`);
      console.log("");
      console.log("To confirm deletion, run with --force flag:");
      console.log(`   pnpm delete-tenant ${identifier} --force`);
      console.log("");
      console.log("For permanent deletion (hard delete), use:");
      console.log(`   pnpm purge-tenant ${identifier} --force`);
      console.log("");
      await manager.close();
      process.exit(0);
    }

    await manager.deleteTenant(tenant.organizationId);

    console.log("✅ Tenant soft deleted successfully!");
    console.log("   Status: deleted");
    console.log("   Database preserved (can be recovered)");
    console.log("");

    await manager.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to delete tenant");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error(error);
    }
    await manager.close();
    process.exit(1);
  }
}

void main();
