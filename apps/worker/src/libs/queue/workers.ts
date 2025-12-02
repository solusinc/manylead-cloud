import type { Worker, Queue } from "bullmq";
import { createWorker, createQueue } from "@manylead/clients/queue";
import { createLogger } from "~/libs/utils/logger";
import type { TenantProvisioningJobData } from "~/workers/tenant-provisioning";
import type { ChannelSyncJobData } from "~/workers/channel-sync";
import type { MediaDownloadJobData } from "~/workers/media-download";
import type { AttachmentCleanupJobData } from "~/workers/attachment-cleanup";
import type { AttachmentOrphanCleanupJobData } from "~/workers/attachment-orphan-cleanup";
import type { QuickReplyOrphanCleanupJobData } from "~/workers/quick-reply-orphan-cleanup";
import type { CrossOrgLogoSyncJobData } from "~/workers/cross-org-logo-sync";
import type { ScheduledMessageJobData } from "~/workers/scheduled-message";
import type { ChannelStatusReconciliationJobData } from "~/workers/channel-status-reconciliation";
import { env } from "~/env";
import { getRedisClient } from "~/libs/cache/redis";
import { processTenantProvisioning } from "~/workers/tenant-provisioning";
import { processChannelSync } from "~/workers/channel-sync";
import { processMediaDownload } from "~/workers/media-download";
import { processAttachmentCleanup } from "~/workers/attachment-cleanup";
import { processAttachmentOrphanCleanup } from "~/workers/attachment-orphan-cleanup";
import { processQuickReplyOrphanCleanup } from "~/workers/quick-reply-orphan-cleanup";
import { processCrossOrgLogoSync } from "~/workers/cross-org-logo-sync";
import { processScheduledMessage } from "~/workers/scheduled-message";
import { processChannelStatusReconciliation } from "~/workers/channel-status-reconciliation";

const logger = createLogger("Worker:Queue");

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

  const tenantProvisioningWorker = createWorker<TenantProvisioningJobData>({
    name: env.QUEUE_TENANT_PROVISIONING,
    processor: processTenantProvisioning,
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    logger,
  });

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

  const channelSyncWorker = createWorker<ChannelSyncJobData>({
    name: env.QUEUE_CHANNEL_SYNC,
    processor: processChannelSync,
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    logger,
  });

  attachEventListeners(channelSyncWorker, {
    queueName: env.QUEUE_CHANNEL_SYNC,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_CHANNEL_SYNC}`);
  workers.push(channelSyncWorker);

  /**
   * Media Download Worker
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_MEDIA_DOWNLOAD}`);

  const mediaDownloadWorker = createWorker<MediaDownloadJobData>({
    name: env.QUEUE_MEDIA_DOWNLOAD,
    processor: processMediaDownload,
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    config: {
      limiter: {
        max: 10, // Max 10 downloads per...
        duration: 1000, // ...second (rate limiting)
      },
    },
    logger,
  });

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

  const attachmentCleanupWorker = createWorker<AttachmentCleanupJobData>({
    name: env.QUEUE_ATTACHMENT_CLEANUP,
    processor: processAttachmentCleanup,
    connection,
    concurrency: 1, // Process one organization at a time
    logger,
  });

  attachEventListeners(attachmentCleanupWorker, {
    queueName: env.QUEUE_ATTACHMENT_CLEANUP,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_ATTACHMENT_CLEANUP}`);
  workers.push(attachmentCleanupWorker);

  /**
   * Attachment Orphan Cleanup Worker (Cron)
   * Limpa arquivos órfãos no R2 e sincroniza com DB:
   * - Deleta arquivos do R2 sem registro no DB
   * - Marca registros do DB como expired se arquivo foi deletado
   */
  logger.info("Creating worker for queue: attachment-orphan-cleanup");

  const attachmentOrphanCleanupWorker = createWorker<AttachmentOrphanCleanupJobData>({
    name: "attachment-orphan-cleanup",
    processor: processAttachmentOrphanCleanup,
    connection,
    concurrency: 1, // Process one organization at a time
    logger,
  });

  attachEventListeners(attachmentOrphanCleanupWorker, {
    queueName: "attachment-orphan-cleanup",
  });

  logger.info("Worker created for queue: attachment-orphan-cleanup");
  workers.push(attachmentOrphanCleanupWorker);

  /**
   * Quick Reply Orphan Cleanup Worker (Cron)
   * Limpa arquivos órfãos de quick replies no R2:
   * - Deleta arquivos do R2 sem registro no DB (messages JSONB)
   */
  logger.info("Creating worker for queue: quick-reply-orphan-cleanup");

  const quickReplyOrphanCleanupWorker = createWorker<QuickReplyOrphanCleanupJobData>({
    name: "quick-reply-orphan-cleanup",
    processor: processQuickReplyOrphanCleanup,
    connection,
    concurrency: 1, // Process one organization at a time
    logger,
  });

  attachEventListeners(quickReplyOrphanCleanupWorker, {
    queueName: "quick-reply-orphan-cleanup",
  });

  logger.info("Worker created for queue: quick-reply-orphan-cleanup");
  workers.push(quickReplyOrphanCleanupWorker);

  /**
   * Cross-Org Logo Sync Worker
   * Sincroniza logos cross-org quando uma organização atualiza seu logo
   */
  logger.info(`Creating worker for queue: ${env.QUEUE_CROSS_ORG_LOGO_SYNC}`);

  const crossOrgLogoSyncWorker = createWorker<CrossOrgLogoSyncJobData>({
    name: env.QUEUE_CROSS_ORG_LOGO_SYNC,
    processor: processCrossOrgLogoSync,
    connection,
    concurrency: 1, // Process one logo sync at a time to avoid DB pressure
    logger,
  });

  attachEventListeners(crossOrgLogoSyncWorker, {
    queueName: env.QUEUE_CROSS_ORG_LOGO_SYNC,
  });

  logger.info(`Worker created for queue: ${env.QUEUE_CROSS_ORG_LOGO_SYNC}`);
  workers.push(crossOrgLogoSyncWorker);

  /**
   * Scheduled Message Worker
   * Processa mensagens/notas agendadas para envio futuro
   */
  logger.info("Creating worker for queue: scheduled-message");

  const scheduledMessageWorker = createWorker<ScheduledMessageJobData>({
    name: "scheduled-message",
    processor: processScheduledMessage,
    connection,
    concurrency: 5, // Process multiple scheduled messages concurrently
    logger,
  });

  attachEventListeners(scheduledMessageWorker, {
    queueName: "scheduled-message",
  });

  logger.info("Worker created for queue: scheduled-message");
  workers.push(scheduledMessageWorker);

  /**
   * Channel Status Reconciliation Worker (Cron)
   * Verifica periodicamente o status dos canais na Evolution API
   * e sincroniza com o banco de dados caso haja divergência
   */
  logger.info("Creating worker for queue: channel-status-reconciliation");

  const channelStatusReconciliationWorker = createWorker<ChannelStatusReconciliationJobData>({
    name: "channel-status-reconciliation",
    processor: processChannelStatusReconciliation,
    connection,
    concurrency: 1, // Process one reconciliation at a time
    logger,
  });

  attachEventListeners(channelStatusReconciliationWorker, {
    queueName: "channel-status-reconciliation",
  });

  logger.info("Worker created for queue: channel-status-reconciliation");
  workers.push(channelStatusReconciliationWorker);

  /**
   * TODO (FASE 4): Add Tenant Migration Worker
   * const tenantMigrationWorker = new Worker(...)
   */

  return workers;
}

/**
 * Create queue instances for health monitoring
 * Note: These are Queue instances (for inspection), not Workers
 */
export function createQueuesForMonitoring(): { name: string; queue: Queue }[] {
  const connection = getRedisClient();

  return [
    {
      name: "tenant-provisioning",
      queue: createQueue({ name: "tenant-provisioning", connection }),
    },
    {
      name: "channel-sync",
      queue: createQueue({ name: "channel-sync", connection }),
    },
    {
      name: "media-download",
      queue: createQueue({ name: "media-download", connection }),
    },
    {
      name: "attachment-cleanup",
      queue: createQueue({ name: "attachment-cleanup", connection }),
    },
    {
      name: "attachment-orphan-cleanup",
      queue: createQueue({ name: "attachment-orphan-cleanup", connection }),
    },
    {
      name: "quick-reply-orphan-cleanup",
      queue: createQueue({ name: "quick-reply-orphan-cleanup", connection }),
    },
    {
      name: "cross-org-logo-sync",
      queue: createQueue({ name: "cross-org-logo-sync", connection }),
    },
    {
      name: "scheduled-message",
      queue: createQueue({ name: "scheduled-message", connection }),
    },
    {
      name: "channel-status-reconciliation",
      queue: createQueue({ name: "channel-status-reconciliation", connection }),
    },
  ];
}
