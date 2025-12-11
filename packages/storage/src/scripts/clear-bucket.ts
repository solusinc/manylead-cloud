import { storage } from "../client";

async function clearBucket() {
  console.log("🗑️  Clearing R2 bucket...");

  let totalDeleted = 0;
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log(`\n📦 Fetching page ${page}...`);

    // List objects (max 1000 per request)
    const objects = await storage.list("", 1000);

    if (objects.length === 0) {
      console.log("✅ No more objects to delete");
      break;
    }

    console.log(`Found ${objects.length} objects`);

    // Delete in batches
    for (const obj of objects) {
      await storage.delete(obj.key);
      totalDeleted++;

      if (totalDeleted % 100 === 0) {
        console.log(`🗑️  Deleted ${totalDeleted} objects...`);
      }
    }

    // If we got less than 1000, we're done
    if (objects.length < 1000) {
      break;
    }

    page++;
  }

  console.log(`\n✅ Bucket cleared! Total objects deleted: ${totalDeleted}`);
}

clearBucket()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
