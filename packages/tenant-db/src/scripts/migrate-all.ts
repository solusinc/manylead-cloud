import { TenantDatabaseManager } from "../tenant-manager";

async function main() {
  const args = process.argv.slice(2);

  const parallelArg = args.find((arg) => arg.startsWith("--parallel="));
  const parallel = parallelArg ? parallelArg.split("=")[1] === "true" : true;

  const concurrencyArg = args.find((arg) => arg.startsWith("--max-concurrency="));
  const maxConcurrency = concurrencyArg
    ? parseInt(concurrencyArg.split("=")[1] ?? "5")
    : 5;

  const continueOnErrorArg = args.find((arg) =>
    arg.startsWith("--continue-on-error="),
  );
  const continueOnError = continueOnErrorArg
    ? continueOnErrorArg.split("=")[1] === "true"
    : false;

  console.log("🔄 Running migrations for all active tenants...");
  console.log(`   Parallel: ${parallel}`);
  console.log(`   Max Concurrency: ${maxConcurrency}`);
  console.log(`   Continue on Error: ${continueOnError}`);
  console.log("");

  const manager = new TenantDatabaseManager();

  try {
    const startTime = Date.now();

    const results = await manager.migrateAll({
      parallel,
      maxConcurrency,
      continueOnError,
    });

    const duration = Date.now() - startTime;

    console.log("");
    console.log("📊 Migration Results:");
    console.log(`   Total: ${results.length}`);
    console.log(`   Success: ${results.filter((r) => r.success).length}`);
    console.log(`   Failed: ${results.filter((r) => !r.success).length}`);
    console.log(`   Duration: ${duration}ms`);
    console.log("");

    results.forEach((result) => {
      const icon = result.success ? "✅" : "❌";
      const duration = `${result.duration}ms`;
      console.log(`   ${icon} ${result.slug} (${duration})`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log("");

    await manager.close();

    const hasFailures = results.some((r) => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration failed");
    console.error(error);
    await manager.close();
    process.exit(1);
  }
}

void main();
