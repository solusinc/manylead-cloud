import type { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { env } from "../env";
import { REDIS_CHANNELS } from "./types";
import { handleProvisioningEvent } from "./handlers";

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

    // Initialize Redis subscriber with optimized settings
    this.subscriber = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      enableAutoPipelining: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Redis PubSub] Retrying connection in ${delay}ms...`);
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
      console.log("[Redis PubSub] Connection ready/reconnected");
      void this.resubscribe();
    });

    this.subscriber.on("reconnecting", () => {
      console.log("[Redis PubSub] Reconnecting...");
    });

    this.subscriber.on("error", (error) => {
      console.error("[Redis PubSub] Error:", error);
    });

    this.subscriber.on("close", () => {
      console.log("[Redis PubSub] Connection closed");
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

      console.log(
        `[Redis PubSub] ✅ Subscribed to channels:`,
        channels
      );
      console.log(`[Redis PubSub] Status: ${this.subscriber.status}`);
    } catch (error) {
      console.error("[Redis PubSub] Failed to setup subscriptions:", error);
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
      console.log("[Redis PubSub] ✅ Resubscribed after reconnection");
    } catch (error) {
      console.error("[Redis PubSub] Failed to resubscribe:", error);
    }
  }

  /**
   * Route messages to appropriate handlers based on channel
   */
  private routeMessage(channel: string, message: string): void {
    console.log(`[Redis PubSub] Message received on channel: ${channel}`);

    switch (channel) {
      case REDIS_CHANNELS.PROVISIONING:
        handleProvisioningEvent(this.io, message);
        break;

      default:
        console.warn(`[Redis PubSub] Unknown channel: ${channel}`);
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async close(): Promise<void> {
    console.log("[Redis PubSub] Closing connection...");
    await this.subscriber.quit();
    console.log("[Redis PubSub] ✅ Connection closed");
  }
}
