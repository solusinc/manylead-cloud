import Redis from "ioredis";

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
    message: Record<string, unknown>;
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
  if (!publisher) {
    publisher = new Redis(redisUrl, {
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
export async function publishChatEvent(
  event: ChatEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
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
export async function publishMessageEvent(
  event: MessageEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
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
export async function publishTypingEvent(
  event: TypingEvent,
  redisUrl: string,
): Promise<void> {
  try {
    const redis = getPublisher(redisUrl);
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
