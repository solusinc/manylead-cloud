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

  // Event listeners for tenant provisioning worker
  tenantProvisioningWorker.on("ready", () => {
    logger.info(
      { queueName: env.QUEUE_TENANT_PROVISIONING },
      "Worker ready",
    );
  });

  tenantProvisioningWorker.on("error", (err) => {
    logger.error(
      { queueName: env.QUEUE_TENANT_PROVISIONING, error: err.message },
      "Worker error",
    );
  });

  tenantProvisioningWorker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, queueName: env.QUEUE_TENANT_PROVISIONING },
      "Job completed",
    );
  });

  tenantProvisioningWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        queueName: env.QUEUE_TENANT_PROVISIONING,
        error: err.message,
      },
      "Job failed",
    );
  });

  tenantProvisioningWorker.on("progress", (job, progress) => {
    logger.debug(
      {
        jobId: job.id,
        queueName: env.QUEUE_TENANT_PROVISIONING,
        progress,
      },
      "Job progress",
    );
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

  // Event listeners for channel sync worker
  channelSyncWorker.on("ready", () => {
    logger.info({ queueName: env.QUEUE_CHANNEL_SYNC }, "Worker ready");
  });

  channelSyncWorker.on("error", (err) => {
    logger.error(
      { queueName: env.QUEUE_CHANNEL_SYNC, error: err.message },
      "Worker error"
    );
  });

  channelSyncWorker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, queueName: env.QUEUE_CHANNEL_SYNC },
      "Job completed"
    );
  });

  channelSyncWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        queueName: env.QUEUE_CHANNEL_SYNC,
        error: err.message,
      },
      "Job failed"
    );
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

  // Event listeners for media download worker
  mediaDownloadWorker.on("ready", () => {
    logger.info({ queueName: env.QUEUE_MEDIA_DOWNLOAD }, "Worker ready");
  });

  mediaDownloadWorker.on("error", (err) => {
    logger.error(
      { queueName: env.QUEUE_MEDIA_DOWNLOAD, error: err.message },
      "Worker error",
    );
  });

  mediaDownloadWorker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, queueName: env.QUEUE_MEDIA_DOWNLOAD },
      "Job completed",
    );
  });

  mediaDownloadWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        queueName: env.QUEUE_MEDIA_DOWNLOAD,
        error: err.message,
      },
      "Job failed",
    );
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

  // Event listeners for attachment cleanup worker
  attachmentCleanupWorker.on("ready", () => {
    logger.info({ queueName: env.QUEUE_ATTACHMENT_CLEANUP }, "Worker ready");
  });

  attachmentCleanupWorker.on("error", (err) => {
    logger.error(
      { queueName: env.QUEUE_ATTACHMENT_CLEANUP, error: err.message },
      "Worker error",
    );
  });

  attachmentCleanupWorker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, queueName: env.QUEUE_ATTACHMENT_CLEANUP },
      "Job completed",
    );
  });

  attachmentCleanupWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        queueName: env.QUEUE_ATTACHMENT_CLEANUP,
        error: err.message,
      },
      "Job failed",
    );
  });

  logger.info(`Worker created for queue: ${env.QUEUE_ATTACHMENT_CLEANUP}`);
  workers.push(attachmentCleanupWorker);

  /**
   * TODO (FASE 4): Add Tenant Migration Worker
   * const tenantMigrationWorker = new Worker(...)
   */

  return workers;
}
