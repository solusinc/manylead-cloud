import { TenantDatabaseManager } from "../tenant-manager";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: pnpm purge-tenant <slug-or-id> --force");
    console.error("Example: pnpm purge-tenant acme-corp --force");
    console.error("");
    console.error("⚠️  WARNING: This is a PERMANENT operation!");
    console.error("   - Deletes the physical database");
    console.error("   - Removes all tenant data");
    console.error("   - Cannot be recovered");
    process.exit(1);
  }

  const identifier = args[0];

  if (!identifier) {
    console.error("❌ Tenant identifier is required");
    process.exit(1);
  }

  const forceArg = args.find((arg) => arg === "--force");
  const force = !!forceArg;

  console.log("🔥 PURGING tenant (PERMANENT DELETE)...");
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
      console.log("🚨 DANGER ZONE - PERMANENT DELETION 🚨");
      console.log("");
      console.log("This will PERMANENTLY delete:");
      console.log(`   - Tenant: ${tenant.name} (${tenant.slug})`);
      console.log(`   - Database: ${tenant.databaseName}`);
      console.log(`   - All data in the database`);
      console.log(`   - All activity logs and metrics`);
      console.log("");
      console.log("⚠️  THIS CANNOT BE UNDONE!");
      console.log("");
      console.log("To confirm PERMANENT deletion, run:");
      console.log(`   pnpm purge-tenant ${identifier} --force`);
      console.log("");
      console.log("For soft delete (recoverable), use:");
      console.log(`   pnpm delete-tenant ${identifier} --force`);
      console.log("");
      await manager.close();
      process.exit(0);
    }

    await manager.purgeTenant(tenant.organizationId);

    console.log("✅ Tenant permanently purged!");
    console.log("   Database deleted");
    console.log("   Catalog record removed");
    console.log("   All data destroyed");
    console.log("");

    await manager.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to purge tenant");
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
