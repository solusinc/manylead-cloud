import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "../src/libs/cache/redis";
import { env } from "../src/env";

async function clearCronJobs() {
  console.log("🧹 Clearing old cron jobs...");

  const connection = getRedisClient();

  try {
    // 1. Clear attachment-cleanup
    const cleanupQueue = createQueue({
      name: env.QUEUE_ATTACHMENT_CLEANUP,
      connection,
    });

    const cleanupJobs = await cleanupQueue.getRepeatableJobs();
    console.log(`Found ${cleanupJobs.length} attachment-cleanup repeatable jobs`);

    for (const job of cleanupJobs) {
      await cleanupQueue.removeRepeatableByKey(job.key);
      console.log(`✅ Removed: ${job.name} (${job.key})`);
    }

    // 2. Clear attachment-orphan-cleanup
    const orphanQueue = createQueue({
      name: "attachment-orphan-cleanup",
      connection,
    });

    const orphanJobs = await orphanQueue.getRepeatableJobs();
    console.log(`Found ${orphanJobs.length} attachment-orphan-cleanup repeatable jobs`);

    for (const job of orphanJobs) {
      await orphanQueue.removeRepeatableByKey(job.key);
      console.log(`✅ Removed: ${job.name} (${job.key})`);
    }

    console.log("✅ All cron jobs cleared!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing cron jobs:", error);
    process.exit(1);
  }
}

void clearCronJobs();
