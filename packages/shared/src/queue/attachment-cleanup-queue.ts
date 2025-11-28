import type { Queue } from "bullmq";
import { createRedisClient } from "@manylead/clients/redis";
import { createQueue } from "@manylead/clients/queue";
import { createLogger } from "@manylead/clients/logger";

/**
 * Attachment cleanup job data
 */
export interface AttachmentCleanupJobData {
  organizationId: string;
}

/**
 * Create attachment cleanup queue
 */
export function createAttachmentCleanupQueue(
  redisUrl: string,
  queueName = "attachment-cleanup",
): Queue<AttachmentCleanupJobData> {
  const logger = createLogger({ component: "AttachmentCleanupQueue" });
  const connection = createRedisClient({
    url: redisUrl,
    preset: "queue",
    logger,
  });

  return createQueue<AttachmentCleanupJobData>({
    name: queueName,
    connection,
    preset: "cleanup",
    logger,
  });
}

/**
 * Enqueue attachment cleanup job for a specific organization
 */
export async function enqueueAttachmentCleanup(
  queue: Queue<AttachmentCleanupJobData>,
  organizationId: string,
) {
  return queue.add(
    "cleanup-attachments",
    { organizationId },
    {
      jobId: `cleanup-${organizationId}`, // Evita duplicação
    },
  );
}

/**
 * Schedule attachment cleanup job to run daily at 3 AM
 * for a specific organization
 */
export async function scheduleAttachmentCleanup(
  queue: Queue<AttachmentCleanupJobData>,
  organizationId: string,
) {
  return queue.add(
    "cleanup-attachments",
    { organizationId },
    {
      jobId: `cleanup-${organizationId}`,
      repeat: {
        pattern: "0 3 * * *", // Diariamente às 3h da manhã
      },
    },
  );
}
