import Redis from "ioredis";

import type { ChatEvent, MessageEvent, TypingEvent } from "./types";
import { env } from "../env";
import { REDIS_CHANNELS } from "./types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("RedisPublisher");

/**
 * Redis Publisher Singleton
 *
 * Manages Redis connection for publishing events to channels.
 * Used by services to broadcast events that will be picked up by RedisPubSubManager.
 */
export class RedisPublisher {
  private static instance: RedisPublisher | null = null;
  private client: Redis;

  private constructor() {
    this.client = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      enableAutoPipelining: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on("error", (error) => {
      log.error({ err: error }, "Redis error");
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RedisPublisher {
    RedisPublisher.instance ??= new RedisPublisher();
    return RedisPublisher.instance;
  }

  /**
   * Publish chat event to Redis
   */
  public async publishChatEvent(event: ChatEvent): Promise<void> {
    try {
      await this.client.publish(REDIS_CHANNELS.CHAT, JSON.stringify(event));
      log.info({ eventType: event.type, chatId: event.chatId }, "Published chat event");
    } catch (error) {
      log.error({ err: error, eventType: event.type, chatId: event.chatId }, "Failed to publish chat event");
      throw error;
    }
  }

  /**
   * Publish message event to Redis
   */
  public async publishMessageEvent(event: MessageEvent): Promise<void> {
    try {
      await this.client.publish(REDIS_CHANNELS.MESSAGE, JSON.stringify(event));
      log.info({ eventType: event.type, messageId: event.messageId }, "Published message event");
    } catch (error) {
      log.error({ err: error, eventType: event.type, messageId: event.messageId }, "Failed to publish message event");
      throw error;
    }
  }

  /**
   * Publish typing event to Redis
   */
  public async publishTypingEvent(event: TypingEvent): Promise<void> {
    try {
      await this.client.publish(REDIS_CHANNELS.TYPING, JSON.stringify(event));
      log.info({ eventType: event.type, chatId: event.chatId }, "Published typing event");
    } catch (error) {
      log.error({ err: error, eventType: event.type, chatId: event.chatId }, "Failed to publish typing event");
      // Don't throw - typing indicators are not critical
    }
  }

  /**
   * Close publisher connection (call on shutdown)
   */
  public async close(): Promise<void> {
    await this.client.quit();
    log.info("Connection closed");
    RedisPublisher.instance = null;
  }
}

// Export helper functions for backwards compatibility
export async function publishChatEvent(event: ChatEvent): Promise<void> {
  return RedisPublisher.getInstance().publishChatEvent(event);
}

export async function publishMessageEvent(event: MessageEvent): Promise<void> {
  return RedisPublisher.getInstance().publishMessageEvent(event);
}

export async function publishTypingEvent(event: TypingEvent): Promise<void> {
  return RedisPublisher.getInstance().publishTypingEvent(event);
}

export async function closePublisher(): Promise<void> {
  return RedisPublisher.getInstance().close();
}
