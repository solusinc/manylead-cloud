import { Queue } from "bullmq";
import { getRedisClient } from "./redis";

/**
 * Channel Sessions Queue (lazy initialization)
 *
 * Manages WhatsApp Baileys session lifecycle (start/stop)
 */
let channelSessionsQueueInstance: Queue | null = null;

export function getChannelSessionsQueue(): Queue {
  channelSessionsQueueInstance ??= new Queue("channel-sessions", {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600,
      },
      removeOnFail: {
        count: 500,
      },
    },
  });

  return channelSessionsQueueInstance;
}

/**
 * Close all queues
 */
export async function closeQueues() {
  if (channelSessionsQueueInstance) {
    await channelSessionsQueueInstance.close();
    channelSessionsQueueInstance = null;
  }
}
