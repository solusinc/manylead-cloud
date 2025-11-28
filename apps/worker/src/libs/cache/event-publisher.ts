import Redis from "ioredis";
import { env } from "~/env";
import { logger } from "~/libs/utils/logger";

/**
 * Event Publisher Singleton
 *
 * Manages a single Redis connection for publishing events to Socket.io
 * via Redis Pub/Sub.
 *
 * Used by workers to send real-time updates:
 * - tenant:provisioning (tenant provisioning progress)
 * - channel:sync (channel sync status)
 */
class EventPublisher {
  private static instance: Redis | null = null;

  /**
   * Get Redis publisher instance (singleton)
   *
   * Creates a new connection on first call, reuses it on subsequent calls.
   * Connection is configured for optimal pub/sub performance.
   */
  static getPublisher(): Redis {
    if (!EventPublisher.instance) {
      EventPublisher.instance = new Redis(env.REDIS_URL, {
        lazyConnect: false, // Connect immediately
        enableAutoPipelining: true, // Batch publish commands for performance
        keepAlive: 30000, // Keep TCP connection alive for 30 seconds
        connectTimeout: 10000, // 10 second timeout for initial connection
      });

      EventPublisher.instance.on("ready", () => {
        logger.info("Redis event publisher ready");
      });

      EventPublisher.instance.on("error", (err) => {
        logger.error(
          { error: err.message, stack: err.stack },
          "Redis event publisher error",
        );
      });

      logger.info("Redis event publisher initialized");
    }

    return EventPublisher.instance;
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
   * Close Redis connection (called on graceful shutdown)
   *
   * Cleanly closes the connection and resets the singleton instance.
   * Should be called in the gracefulShutdown handler.
   */
  static async close(): Promise<void> {
    if (EventPublisher.instance) {
      await EventPublisher.instance.quit();
      EventPublisher.instance = null;
      logger.info("Redis event publisher closed");
    }
  }
}

export const eventPublisher = EventPublisher;
