import type { Queue } from "bullmq";
import { createRedisClient } from "@manylead/clients/redis";
import { createQueue } from "@manylead/clients/queue";
import { createLogger } from "@manylead/clients/logger";

/**
 * Audio send job data
 *
 * Job para converter áudio e enviar para WhatsApp
 */
export interface AudioSendJobData {
  organizationId: string;
  chatId: string;
  messageId: string;
  attachmentId: string;

  // Dados do chat
  instanceName: string;
  phoneNumber: string;

  // Dados do áudio original
  audioUrl: string;
  audioStoragePath: string;
  audioMimeType: string;
  audioFileName: string;
  duration?: number;

  // Dados da mensagem
  caption: string;
  whatsappMessageId?: string; // Para reply
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
  };
}

/**
 * Create audio send queue
 */
export function createAudioSendQueue(redisUrl: string, queueName = "audio-send"): Queue<AudioSendJobData> {
  const logger = createLogger({ component: "AudioSendQueue" });
  const connection = createRedisClient({
    url: redisUrl,
    preset: "queue",
    logger,
  });

  return createQueue<AudioSendJobData>({
    name: queueName,
    connection,
    preset: "default", // Retry com backoff exponencial
    logger,
  });
}

/**
 * Enqueue audio send job
 */
export async function enqueueAudioSend(
  queue: Queue<AudioSendJobData>,
  data: AudioSendJobData,
) {
  return queue.add("send-audio", data, {
    jobId: `audio-send-${data.messageId}`, // Evita duplicação
  });
}
