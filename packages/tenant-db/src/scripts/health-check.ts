import { TenantDatabaseManager } from "../tenant-manager";

async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];

  const manager = new TenantDatabaseManager();

  try {
    if (identifier) {
      console.log("🏥 Checking health for specific tenant...");
      console.log(`   Identifier: ${identifier}`);
      console.log("");

      let tenant = await manager.getTenantBySlug(identifier);

      tenant ??= await manager.getTenantById(identifier);

      if (!tenant) {
        console.error(`❌ Tenant not found: ${identifier}`);
        await manager.close();
        process.exit(1);
      }

      const result = await manager.checkTenantHealth(tenant.id);

      const icon = result.status === "healthy" ? "✅" : "❌";
      console.log(`${icon} Tenant: ${result.slug}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Can Connect: ${result.canConnect}`);
      console.log(`   Database Exists: ${result.databaseExists}`);
      if (result.schemaVersion) {
        console.log(`   Schema Version: ${result.schemaVersion}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log("");

      await manager.close();
      process.exit(result.status === "healthy" ? 0 : 1);
    } else {
      console.log("🏥 Checking health for all tenants...");
      console.log("");

      const results = await manager.checkAllTenantsHealth();

      console.log("📊 Health Check Results:");
      console.log(`   Total: ${results.length}`);
      console.log(`   Healthy: ${results.filter((r) => r.status === "healthy").length}`);
      console.log(
        `   Unhealthy: ${results.filter((r) => r.status === "unhealthy").length}`,
      );
      console.log("");

      results.forEach((result) => {
        const icon = result.status === "healthy" ? "✅" : "❌";
        console.log(`${icon} ${result.slug}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      });

      console.log("");

      await manager.close();

      const hasUnhealthy = results.some((r) => r.status === "unhealthy");
      process.exit(hasUnhealthy ? 1 : 0);
    }
  } catch (error) {
    console.error("❌ Health check failed");
    console.error(error);
    await manager.close();
    process.exit(1);
  }
}

void main();
