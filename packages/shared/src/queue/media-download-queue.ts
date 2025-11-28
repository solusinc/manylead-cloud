import type { Queue } from "bullmq";
import { createRedisClient } from "@manylead/clients/redis";
import { createQueue } from "@manylead/clients/queue";
import { createLogger } from "@manylead/clients/logger";

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
export function createMediaDownloadQueue(redisUrl: string, queueName = "media-download"): Queue<MediaDownloadJobData> {
  const logger = createLogger({ component: "MediaDownloadQueue" });
  const connection = createRedisClient({
    url: redisUrl,
    preset: "queue",
    logger,
  });

  return createQueue<MediaDownloadJobData>({
    name: queueName,
    connection,
    preset: "media-download",
    logger,
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
