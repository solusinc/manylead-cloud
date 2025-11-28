import type { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { env } from "../env";
import { REDIS_CHANNELS } from "./types";
import {
  handleProvisioningEvent,
  handleChannelSyncEvent,
  handleChatEvent,
  handleMessageEvent,
  handleTypingEvent,
} from "./handlers";
import { createLogger } from "../libs/utils/logger";

const log = createLogger("RedisPubSub");

/**
 * Redis Pub/Sub Manager for Socket.io events
 *
 * Manages subscriptions to Redis channels and routes messages
 * to appropriate handlers
 */
export class RedisPubSubManager {
  private subscriber: Redis;
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;

    log.info({ redisUrl: env.REDIS_URL.replace(/:[^:]*@/, ':***@') }, "Initializing Redis subscriber...");

    // Initialize Redis subscriber with optimized settings
    this.subscriber = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      enableAutoPipelining: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        log.info({ times, delay }, "Retrying connection...");
        return delay;
      },
    });

    this.setupHandlers();
    void this.setupSubscriptions();
  }

  /**
   * Setup Redis event handlers
   */
  private setupHandlers(): void {
    // Handle incoming messages
    this.subscriber.on("message", (channel, message) => {
      this.routeMessage(channel, message);
    });

    // Handle reconnection
    this.subscriber.on("ready", () => {
      log.info("Connection ready/reconnected");
      void this.resubscribe();
    });

    this.subscriber.on("reconnecting", () => {
      log.info("Reconnecting...");
    });

    this.subscriber.on("error", (error) => {
      log.error({ err: error }, "Redis error");
    });

    this.subscriber.on("close", () => {
      log.info("Connection closed");
    });
  }

  /**
   * Subscribe to all Redis channels
   */
  private async setupSubscriptions(): Promise<void> {
    try {
      // Wait for connection to be ready
      if (this.subscriber.status !== "ready") {
        await new Promise<void>((resolve) => {
          this.subscriber.once("ready", resolve);
        });
      }

      // Subscribe to all channels
      const channels = Object.values(REDIS_CHANNELS);
      await this.subscriber.subscribe(...channels);

      log.info({ channels, status: this.subscriber.status }, "✅ Subscribed to channels");
    } catch (error) {
      log.error({ err: error }, "Failed to setup subscriptions");
      throw error;
    }
  }

  /**
   * Resubscribe after reconnection
   */
  private async resubscribe(): Promise<void> {
    try {
      const channels = Object.values(REDIS_CHANNELS);
      await this.subscriber.subscribe(...channels);
      log.info({ channels }, "✅ Resubscribed after reconnection");
    } catch (error) {
      log.error({ err: error }, "Failed to resubscribe");
    }
  }

  /**
   * Route messages to appropriate handlers based on channel
   */
  private routeMessage(channel: string, message: string): void {
    log.debug({ channel }, "Message received");

    switch (channel) {
      case REDIS_CHANNELS.PROVISIONING:
        handleProvisioningEvent(this.io, message);
        break;

      case REDIS_CHANNELS.CHANNEL_SYNC:
        handleChannelSyncEvent(this.io, message);
        break;

      case REDIS_CHANNELS.CHAT:
        handleChatEvent(this.io, message);
        break;

      case REDIS_CHANNELS.MESSAGE:
        handleMessageEvent(this.io, message);
        break;

      case REDIS_CHANNELS.TYPING:
        handleTypingEvent(this.io, message);
        break;

      default:
        log.warn({ channel }, "Unknown channel");
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async close(): Promise<void> {
    log.info("Closing connection...");
    await this.subscriber.quit();
    log.info("✅ Connection closed");
  }
}
