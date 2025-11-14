import { Worker } from "bullmq";
import type { TenantProvisioningJobData } from "~/workers/tenant-provisioning";
import { env } from "~/env";
import { getRedisClient } from "~/libs/cache/redis";
import { logger } from "~/libs/utils/logger";
import { processTenantProvisioning } from "~/workers/tenant-provisioning";
import { createChannelSessionsWorker } from "~/workers/channel-sessions";

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
   * Channel Sessions Worker (Baileys)
   */
  logger.info("Creating worker for queue: channel-sessions");

  const channelSessionsWorker = createChannelSessionsWorker();

  // Event listeners
  channelSessionsWorker.on("ready", () => {
    logger.info({ queueName: "channel-sessions" }, "Worker ready");
  });

  channelSessionsWorker.on("error", (err) => {
    logger.error(
      { queueName: "channel-sessions", error: err.message },
      "Worker error"
    );
  });

  channelSessionsWorker.on("completed", (job) => {
    logger.info({ jobId: job.id, queueName: "channel-sessions" }, "Job completed");
  });

  channelSessionsWorker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, queueName: "channel-sessions", error: err.message },
      "Job failed"
    );
  });

  logger.info("Worker created for queue: channel-sessions");
  workers.push(channelSessionsWorker);

  /**
   * TODO (FASE 4): Add Tenant Migration Worker
   * const tenantMigrationWorker = new Worker(...)
   */

  return workers;
}
