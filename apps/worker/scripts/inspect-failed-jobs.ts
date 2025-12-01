import { Queue } from "bullmq";
import { getRedisClient } from "~/libs/cache/redis";
import { env } from "~/env";

async function inspectFailedJobs() {
  const connection = getRedisClient();

  const queues = [
    "attachment-cleanup",
    "attachment-orphan-cleanup",
  ];

  for (const queueName of queues) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Queue: ${queueName}`);
    console.log("=".repeat(60));

    const queue = new Queue(queueName, { connection });

    const failed = await queue.getFailed(0, 10);

    if (failed.length === 0) {
      console.log("✅ No failed jobs\n");
      continue;
    }

    console.log(`❌ Found ${failed.length} failed jobs:\n`);

    for (const job of failed) {
      if (!job) {
        console.log("\n[Skipped null job]");
        continue;
      }

      console.log(`\n--- Job ID: ${job.id} ---`);
      console.log(`Data:`, JSON.stringify(job.data, null, 2));
      console.log(`\nError: ${job.failedReason}`);

      if (job.stacktrace && job.stacktrace.length > 0) {
        console.log(`\nStack trace:`);
        console.log(job.stacktrace.join("\n"));
      }

      console.log(`\nAttempts: ${job.attemptsMade}`);
      console.log(`Timestamp: ${new Date(job.timestamp).toISOString()}`);
      console.log("-".repeat(60));
    }

    await queue.close();
  }

  await connection.quit();
  process.exit(0);
}

inspectFailedJobs().catch((error) => {
  console.error("Error inspecting failed jobs:", error);
  process.exit(1);
});
