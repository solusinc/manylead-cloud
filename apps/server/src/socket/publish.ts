import Redis from "ioredis";

import type { ChatEvent, MessageEvent, TypingEvent } from "./types";
import { env } from "../env";
import { REDIS_CHANNELS } from "./types";

// Singleton Redis publisher
let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, {
      lazyConnect: false,
      enableAutoPipelining: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    publisher.on("error", (error) => {
      console.error("[Redis Publisher] Error:", error);
    });
  }

  return publisher;
}

/**
 * Publish chat event to Redis
 */
export async function publishChatEvent(event: ChatEvent): Promise<void> {
  try {
    const redis = getPublisher();
    await redis.publish(REDIS_CHANNELS.CHAT, JSON.stringify(event));
    console.log(
      `[Redis Publisher] Published ${event.type} for chat ${event.chatId}`,
    );
  } catch (error) {
    console.error("[Redis Publisher] Failed to publish chat event:", error);
    throw error;
  }
}

/**
 * Publish message event to Redis
 */
export async function publishMessageEvent(event: MessageEvent): Promise<void> {
  try {
    const redis = getPublisher();
    await redis.publish(REDIS_CHANNELS.MESSAGE, JSON.stringify(event));
    console.log(
      `[Redis Publisher] Published ${event.type} for message ${event.messageId}`,
    );
  } catch (error) {
    console.error("[Redis Publisher] Failed to publish message event:", error);
    throw error;
  }
}

/**
 * Publish typing event to Redis
 */
export async function publishTypingEvent(event: TypingEvent): Promise<void> {
  try {
    const redis = getPublisher();
    await redis.publish(REDIS_CHANNELS.TYPING, JSON.stringify(event));
    console.log(
      `[Redis Publisher] Published ${event.type} for chat ${event.chatId}`,
    );
  } catch (error) {
    console.error("[Redis Publisher] Failed to publish typing event:", error);
    // Don't throw - typing indicators are not critical
  }
}

/**
 * Close publisher connection (call on shutdown)
 */
export async function closePublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
    console.log("[Redis Publisher] Connection closed");
  }
}
