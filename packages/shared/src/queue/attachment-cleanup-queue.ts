import { Queue } from "bullmq";
import Redis from "ioredis";

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
) {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return new Queue<AttachmentCleanupJobData>(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 2, // Retry apenas 1 vez
      backoff: {
        type: "fixed",
        delay: 60000, // 1 minuto
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Remover jobs completados após 24h
        count: 100, // Manter no máximo 100 jobs completados
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Remover jobs falhados após 7 dias
      },
    },
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
