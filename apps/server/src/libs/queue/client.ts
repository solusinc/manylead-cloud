import { Queue } from "bullmq";
import { env } from "~/env";
import { getRedisClient } from "~/libs/cache/redis";
import { logger } from "~/libs/utils/logger";

/**
 * Queue clients for BullMQ
 */

// Tenant provisioning queue
export const tenantProvisioningQueue = new Queue(
  env.QUEUE_TENANT_PROVISIONING,
  {
    connection: getRedisClient(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 3600, // Keep for 24 hours
      },
      removeOnFail: {
        count: 500, // Keep last 500 failed jobs
      },
    },
  },
);

// Tenant migration queue (for future use)
export const tenantMigrationQueue = new Queue(env.QUEUE_TENANT_MIGRATION, {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      count: 50,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 200,
    },
  },
});

// Channel sessions queue (Baileys WhatsApp)
export const channelSessionsQueue = new Queue("channel-sessions", {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // Retry after 5 seconds
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500, // Keep failed jobs for debugging
    },
  },
});

/**
 * Close all queues
 */
export async function closeQueues() {
  await tenantProvisioningQueue.close();
  await tenantMigrationQueue.close();
  await channelSessionsQueue.close();
  logger.info("All queues closed");
}
