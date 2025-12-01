import { Queue } from "bullmq";
import { getRedisClient } from "~/libs/cache/redis";

async function cleanFailedJobs() {
  const connection = getRedisClient();

  const queues = [
    "attachment-cleanup",
    "attachment-orphan-cleanup",
  ];

  console.log("🧹 Cleaning failed jobs...\n");

  for (const queueName of queues) {
    console.log(`Queue: ${queueName}`);

    const queue = new Queue(queueName, { connection });

    // Clean all failed jobs
    const cleaned = await queue.clean(0, 1000, "failed");

    console.log(`✅ Cleaned ${cleaned.length} failed jobs\n`);

    await queue.close();
  }

  await connection.quit();
  console.log("Done!");
  process.exit(0);
}

cleanFailedJobs().catch((error) => {
  console.error("Error cleaning failed jobs:", error);
  process.exit(1);
});
