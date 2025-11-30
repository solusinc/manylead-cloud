import { logger } from "~/libs/utils/logger";
import { getRedisClient } from "./redis";

/**
 * Event Publisher
 *
 * Reuses the main Redis connection for publishing events to Socket.io
 * via Redis Pub/Sub. This avoids creating duplicate connections.
 *
 * Used by workers to send real-time updates:
 * - tenant:provisioning (tenant provisioning progress)
 * - channel:sync (channel sync status)
 * - chat:events (contact/logo updates)
 */
class EventPublisher {
  /**
   * Get Redis connection for publishing
   *
   * Reuses the main BullMQ Redis connection. BullMQ and pub/sub
   * can safely share the same connection.
   */
  static getPublisher() {
    return getRedisClient();
  }

  /**
   * Publish event to Redis channel
   *
   * Serializes event to JSON and publishes to specified channel.
   * Socket.io server subscribes to these channels and broadcasts to clients.
   *
   * @param channel - Redis channel name (e.g., "tenant:provisioning", "channel:sync")
   * @param event - Event object to publish
   */
  static async publish(channel: string, event: unknown): Promise<void> {
    try {
      const publisher = EventPublisher.getPublisher();
      await publisher.publish(channel, JSON.stringify(event));

      logger.debug(
        { channel, event },
        "Published event to Redis",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          channel,
          event,
        },
        "Failed to publish event to Redis",
      );
    }
  }

  /**
   * Close is handled by the main Redis connection (redis.ts)
   * No need for separate cleanup since we're reusing the connection.
   */
  static close(): void {
    logger.info("Event publisher cleanup - connection managed by main Redis client");
  }
}

export const eventPublisher = EventPublisher;
