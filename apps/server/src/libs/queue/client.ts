import { createQueue } from "@manylead/clients/queue";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";
import { getRedisClient } from "~/libs/cache/redis";

const logger = createLogger("Server:Queue");

/**
 * Queue clients for BullMQ
 */

// Tenant provisioning queue
export const tenantProvisioningQueue = createQueue({
  name: env.QUEUE_TENANT_PROVISIONING,
  connection: getRedisClient(),
  preset: "default",
  logger,
});

// Tenant migration queue (for future use)
export const tenantMigrationQueue = createQueue({
  name: env.QUEUE_TENANT_MIGRATION,
  connection: getRedisClient(),
  preset: "default",
  logger,
});

// Channel sync queue
export const channelSyncQueue = createQueue({
  name: env.QUEUE_CHANNEL_SYNC,
  connection: getRedisClient(),
  preset: "default",
  logger,
});

/**
 * Close all queues
 */
export async function closeQueues() {
  await tenantProvisioningQueue.close();
  await tenantMigrationQueue.close();
  await channelSyncQueue.close();
  logger.info("All queues closed");
}
