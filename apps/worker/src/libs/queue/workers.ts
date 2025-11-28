import { Worker } from "bullmq";
import type { TenantProvisioningJobData } from "~/workers/tenant-provisioning";
import type { ChannelSyncJobData } from "~/workers/channel-sync";
import type { MediaDownloadJobData } from "~/workers/media-download";
import type { AttachmentCleanupJobData } from "~/workers/attachment-cleanup";
import { env } from "~/env";
import { getRedisClient } from "~/libs/cache/redis";
import { logger } from "~/libs/utils/logger";
import { processTenantProvisioning } from "~/workers/tenant-provisioning";
import { processChannelSync } from "~/workers/channel-sync";
import { processMediaDownload } from "~/workers/media-download";
import { processAttachmentCleanup } from "~/workers/attachment-cleanup";

/**
 * Worker event listeners configuration
 */
interface WorkerEventListenersOptions {
  queueName: string;
  supportsProgress?: boolean;
}

/**
 * Attach standardized event listeners to a BullMQ worker
 *
 * Centralizes logging logic for all worker events:
 * - ready: Worker initialized and ready to process jobs
 * - error: Worker-level error occurred
 * - completed: Job completed successfully
 * - failed: Job failed with error
 * - progress: Job progress update (optional, only if supportsProgress is true)
 *
 * @param worker - BullMQ worker instance
 * @param options - Configuration options (queueName, supportsProgress)
 */
function attachEventListeners(
  worker: Worker,
  options: WorkerEventListenersOptions,
): void {
  const { queueName, supportsProgress = false } = options;

  worker.on("ready", () => {
    logger.info({ queueName }, "Worker ready");
  });

  worker.on("error", (err) => {
    logger.error(
      { queueName, error: err.message, stack: err.stack },
      "Worker error",
    );
  });

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, queueName },
      "Job completed",
    );
  });

  worker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        queueName,
        error: err.message,
        stack: err.stack,
      },
      "Job failed",
    );
  });

  // Progress listener only for workers that support it
  if (supportsProgress) {
    worker.on("progress", (job, progress) => {
      logger.debug(
        { jobId: job.id, queueName, progress },
        "Job progress",
      );
    });
  }
}

/**
 * Create and configure all BullMQ workers
 */
export function createWorkers(): Worker[] {
  const connection = getRedisClient();
  const workers: Worker[] = [];

  /**
   * Tenant Provisioning Worker
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_TENANT_PROVISIONING}`);

  const tenantProvisioningWorker = new Worker<TenantProvisioningJobData>(
    env.QUEUE_TENANT_PROVISIONING,
    async (job) => {
      return await processTenantProvisioning(job);
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
      autorun: true,
    },
  );

  attachEventListeners(tenantProvisioningWorker, {
    queueName: env.QUEUE_TENANT_PROVISIONING,
    supportsProgress: true, // Only this worker supports progress updates
  });

  logger.info(`Worker created for queue: ${env.QUEUE_TENANT_PROVISIONING}`);
  workers.push(tenantProvisioningWorker);

  /**
   * Channel Sync Worker
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_CHANNEL_SYNC}`);

  const channelSyncWorker = new Worker<ChannelSyncJobData>(
    env.QUEUE_CHANNEL_SYNC,
    async (job) => {
      return await processChannelSync(job);
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
      autorun: true,
    }
  );

  attachEventListeners(channelSyncWorker, {
    queueName: env.QUEUE_CHANNEL_SYNC,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_CHANNEL_SYNC}`);
  workers.push(channelSyncWorker);

  /**
   * Media Download Worker
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_MEDIA_DOWNLOAD}`);

  const mediaDownloadWorker = new Worker<MediaDownloadJobData>(
    env.QUEUE_MEDIA_DOWNLOAD,
    async (job) => {
      return await processMediaDownload(job);
    },
    {
      connection,
      concurrency: env.WORKER_CONCURRENCY,
      autorun: true,
      limiter: {
        max: 10, // Max 10 downloads per...
        duration: 1000, // ...second (rate limiting)
      },
    },
  );

  attachEventListeners(mediaDownloadWorker, {
    queueName: env.QUEUE_MEDIA_DOWNLOAD,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_MEDIA_DOWNLOAD}`);
  workers.push(mediaDownloadWorker);

  /**
   * Attachment Cleanup Worker (Cron)
   * Marca attachments como expirados baseado no R2 lifecycle:
   * - Videos: 48 horas
   * - Outras mídias: 90 dias
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_ATTACHMENT_CLEANUP}`);

  const attachmentCleanupWorker = new Worker<AttachmentCleanupJobData>(
    env.QUEUE_ATTACHMENT_CLEANUP,
    async (job) => {
      return await processAttachmentCleanup(job);
    },
    {
      connection,
      concurrency: 1, // Process one organization at a time
      autorun: true,
    },
  );

  attachEventListeners(attachmentCleanupWorker, {
    queueName: env.QUEUE_ATTACHMENT_CLEANUP,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_ATTACHMENT_CLEANUP}`);
  workers.push(attachmentCleanupWorker);

  /**
   * TODO (FASE 4): Add Tenant Migration Worker
   * const tenantMigrationWorker = new Worker(...)
   */

  return workers;
}
