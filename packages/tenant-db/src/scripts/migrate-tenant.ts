import { TenantDatabaseManager } from "../tenant-manager";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: pnpm migrate:tenant <slug|tenantId>");
    console.error("Example: pnpm migrate:tenant acme-corp");
    process.exit(1);
  }

  const identifier = args[0];

  if (!identifier) {
    console.error("❌ Identifier is required");
    process.exit(1);
  }

  console.log("🔄 Running migrations for tenant...");
  console.log(`   Identifier: ${identifier}`);
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

    console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`   Database: ${tenant.databaseName}`);
    console.log("");

    const startTime = Date.now();
    await manager.migrateTenant(tenant.id);
    const duration = Date.now() - startTime;

    console.log(`✅ Migrations completed in ${duration}ms`);
    console.log("");

    await manager.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    await manager.close();
    process.exit(1);
  }
}

void main();
