import type Redis from "ioredis";
import { createRedisClient } from "@manylead/clients/redis";
import { createLogger } from "@manylead/clients/logger";

const logger = createLogger({ component: "RedisPublisher" });

/**
 * Socket.io Event Types (duplicated from server for independence)
 */
export interface ChatEvent {
  type: "chat:created" | "chat:updated" | "chat:deleted";
  organizationId: string;
  chatId: string;
  targetAgentId?: string; // Para enviar evento personalizado apenas para um agent específico
  data: {
    chat: Record<string, unknown>;
    contact?: Record<string, unknown>;
    assignedAgent?: Record<string, unknown>;
  };
}

export interface MessageEvent {
  type: "message:new" | "message:updated" | "message:deleted";
  organizationId: string;
  chatId: string;
  messageId: string;
  senderId?: string; // Agent ID who sent the message (for filtering/deduplication)
  targetAgentId?: string; // Para enviar evento apenas para um agent específico (chats internos)
  data: {
    message?: Record<string, unknown>; // Opcional para message:deleted
    sender?: Record<string, unknown>;
  };
}

export interface TypingEvent {
  type: "typing:start" | "typing:stop";
  organizationId: string;
  chatId: string;
  userId: string;
  data: {
    userName: string;
  };
}

/**
 * Redis channel names
 */
export const REDIS_CHANNELS = {
  CHAT: "chat:events",
  MESSAGE: "message:events",
  TYPING: "typing:events",
} as const;

// Singleton Redis publisher
let publisher: Redis | null = null;

function getPublisher(redisUrl: string): Redis {
  publisher ??= createRedisClient({
    url: redisUrl,
    preset: "pubsub",
    logger,
  });

  return publisher;
}

/**
 * Publish chat event to Redis
 */
export async function publishChatEvent(
  event: ChatEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
    await redis.publish(REDIS_CHANNELS.CHAT, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error, event }, "Failed to publish chat event");
    throw error;
  }
}

/**
 * Publish message event to Redis
 */
export async function publishMessageEvent(
  event: MessageEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
    await redis.publish(REDIS_CHANNELS.MESSAGE, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error, event }, "Failed to publish message event");
    throw error;
  }
}

/**
 * Publish typing event to Redis
 */
export async function publishTypingEvent(
  event: TypingEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
    await redis.publish(REDIS_CHANNELS.TYPING, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error, event }, "Failed to publish typing event");
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
    logger.info("Redis publisher connection closed");
  }
}
