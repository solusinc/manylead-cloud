import { Queue } from "bullmq";
import Redis from "ioredis";

/**
 * Media download job data
 */
export interface MediaDownloadJobData {
  organizationId: string;
  messageId: string;
  attachmentId: string;
  whatsappMediaId: string;
  instanceName: string;
  fileName: string;
  mimeType: string;
}

/**
 * Create media download queue
 */
export function createMediaDownloadQueue(redisUrl: string, queueName = "media-download") {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return new Queue<MediaDownloadJobData>(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3, // Retry até 3 vezes
      backoff: {
        type: "exponential",
        delay: 5000, // 5s, 25s, 125s
      },
      removeOnComplete: {
        age: 24 * 60 * 60, // Remover jobs completados após 24h
        count: 1000, // Manter no máximo 1000 jobs completados
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60, // Remover jobs falhados após 7 dias
      },
    },
  });
}

/**
 * Enqueue media download job
 */
export async function enqueueMediaDownload(
  queue: Queue<MediaDownloadJobData>,
  data: MediaDownloadJobData,
) {
  return queue.add("download-media", data, {
    jobId: `media-${data.attachmentId}`, // Evita duplicação
  });
}
