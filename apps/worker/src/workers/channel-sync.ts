import type { Job } from "bullmq";
import { channel, eq } from "@manylead/db";
import { logger } from "~/libs/utils/logger";
import { eventPublisher } from "~/libs/cache/event-publisher";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Channel sync job data schema
 */
export interface ChannelSyncJobData {
  channelId: string;
  organizationId: string;
}

/**
 * Process channel sync job
 *
 * TODO: Implement actual message synchronization when messages table is ready
 * For now, just simulates the sync process and updates channel status
 */
export async function processChannelSync(
  job: Job<ChannelSyncJobData>
): Promise<void> {
  const { channelId, organizationId } = job.data;

  logger.info(
    { jobId: job.id, channelId, organizationId },
    "Starting channel message sync"
  );

  try {
    // Get tenant database connection
    const tenantDb = await tenantManager.getConnection(organizationId);

    // Update status to syncing
    await tenantDb
      .update(channel)
      .set({
        syncStatus: "syncing",
        updatedAt: new Date(),
      })
      .where(eq(channel.id, channelId));

    // Publish start event
    await eventPublisher.publish("channel:sync", {
      type: "channel:sync:start",
      organizationId,
      channelId,
      data: {
        message: "Iniciando sincronização de mensagens",
      },
    });

    logger.info({ channelId }, "Channel sync status updated to syncing");

    // TODO: Implement actual message sync here
    // This is where we would:
    // 1. Fetch messages from Evolution API
    // 2. Store them in the messages table
    // 3. Update sync progress
    //
    // For now, simulate processing time (1 minute)
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // Update status to completed
    await tenantDb
      .update(channel)
      .set({
        syncStatus: "completed",
        syncCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(channel.id, channelId));

    // Publish complete event
    await eventPublisher.publish("channel:sync", {
      type: "channel:sync:complete",
      organizationId,
      channelId,
      data: {
        message: "Sincronização concluída",
      },
    });

    logger.info(
      { jobId: job.id, channelId, organizationId },
      "Channel sync completed successfully"
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, channelId, organizationId, error },
      "Channel sync failed"
    );

    try {
      // Get tenant database connection
      const tenantDb = await tenantManager.getConnection(organizationId);

      // Update status to failed
      await tenantDb
        .update(channel)
        .set({
          syncStatus: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: new Date(),
        })
        .where(eq(channel.id, channelId));

      // Publish error event
      await eventPublisher.publish("channel:sync", {
        type: "channel:sync:error",
        organizationId,
        channelId,
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (updateError) {
      logger.error(
        { updateError },
        "Failed to update channel status after sync error"
      );
    }

    throw error;
  }
}
