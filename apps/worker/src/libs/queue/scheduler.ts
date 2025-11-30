import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "~/libs/cache/redis";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";

const logger = createLogger("Worker:Scheduler");

/**
 * Setup cron jobs for periodic tasks
 *
 * Jobs configurados:
 * - attachment-cleanup: Diário às 3h (marca registros como expired)
 * - attachment-orphan-cleanup: Semanal aos domingos às 4h (deleta órfãos)
 */
export async function setupCronJobs() {
  const connection = getRedisClient();

  // Check if testing mode is enabled
  const isTestMode = process.env.ENABLE_TEST_CRON === "true";
  const dryRun = process.env.ENABLE_DRY_RUN === "true";

  try {
    // 1. Attachment Cleanup
    const cleanupQueue = createQueue({
      name: env.QUEUE_ATTACHMENT_CLEANUP,
      connection,
    });

    // Remove existing repeatable jobs to prevent duplicates
    const existingCleanupJobs = await cleanupQueue.getRepeatableJobs();
    for (const job of existingCleanupJobs) {
      await cleanupQueue.removeRepeatableByKey(job.key);
      logger.info(
        { jobKey: job.key, jobName: job.name },
        "Removed existing repeatable job before creating new one"
      );
    }

    await cleanupQueue.add(
      "daily-cleanup",
      { organizationId: "system" },
      {
        repeat: {
          pattern: isTestMode ? "*/30 * * * * *" : "0 3 * * *", // Test: 30s | Prod: 3am
        },
        jobId: "attachment-cleanup-daily",
      }
    );

    logger.info(
      `Cron job configured: attachment-cleanup (${isTestMode ? "every 30s (TEST MODE)" : "daily at 3am"})`
    );

    // 2. Orphan Cleanup
    const orphanQueue = createQueue({
      name: "attachment-orphan-cleanup",
      connection,
    });

    // Remove existing repeatable jobs to prevent duplicates
    const existingOrphanJobs = await orphanQueue.getRepeatableJobs();
    for (const job of existingOrphanJobs) {
      await orphanQueue.removeRepeatableByKey(job.key);
      logger.info(
        { jobKey: job.key, jobName: job.name },
        "Removed existing repeatable job before creating new one"
      );
    }

    await orphanQueue.add(
      "weekly-orphan-cleanup",
      {
        organizationId: "system",
        dryRun, // Control via ENABLE_DRY_RUN env var
      },
      {
        repeat: {
          pattern: isTestMode ? "*/30 * * * * *" : "0 4 * * 0", // Test: 30s | Prod: Sunday 4am
        },
        jobId: "attachment-orphan-cleanup-weekly",
      }
    );

    logger.info(
      `Cron job configured: attachment-orphan-cleanup (${isTestMode ? `every 30s (TEST MODE${dryRun ? " - DRY RUN" : ""})` : "weekly sundays at 4am"})`
    );

    if (isTestMode) {
      logger.warn(`⚠️  TEST MODE ENABLED - Cron jobs running every 30 seconds${dryRun ? " with dry-run" : ""}`);
    }

    logger.info("All cron jobs configured successfully");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to configure cron jobs"
    );
    throw error;
  }
}

/**
 * Remove todos os cron jobs configurados
 */
export async function removeCronJobs() {
  const connection = getRedisClient();

  try {
    const cleanupQueue = createQueue({
      name: env.QUEUE_ATTACHMENT_CLEANUP,
      connection,
    });

    const orphanQueue = createQueue({
      name: "attachment-orphan-cleanup",
      connection,
    });

    await cleanupQueue.removeRepeatable("daily-cleanup", {
      pattern: "0 3 * * *",
    });

    await orphanQueue.removeRepeatable("weekly-orphan-cleanup", {
      pattern: "0 4 * * 0",
    });

    logger.info("Cron jobs removed successfully");
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to remove cron jobs"
    );
    throw error;
  }
}
