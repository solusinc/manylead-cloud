/**
 * Socket.io Event Types
 */

/**
 * Provisioning events
 */
export interface ProvisioningEvent {
  type: "provisioning:progress" | "provisioning:complete" | "provisioning:error";
  organizationId: string;
  data: {
    progress?: number;
    currentStep?: string;
    message?: string;
    error?: string;
  };
}

/**
 * Channel sync events
 */
export interface ChannelSyncEvent {
  type: "channel:sync:start" | "channel:sync:complete" | "channel:sync:error";
  organizationId: string;
  channelId: string;
  data: {
    message?: string;
    error?: string;
  };
}

/**
 * Chat events
 */
export interface ChatEvent {
  type: "chat:created" | "chat:updated" | "chat:deleted";
  organizationId: string;
  chatId: string;
  data: {
    chat: Record<string, unknown>;
    contact?: Record<string, unknown>;
    assignedAgent?: Record<string, unknown>;
  };
}

/**
 * Message events
 */
export interface MessageEvent {
  type: "message:new" | "message:updated" | "message:deleted";
  organizationId: string;
  chatId: string;
  messageId: string;
  data: {
    message: Record<string, unknown>;
    sender?: Record<string, unknown>;
  };
}

/**
 * Typing indicator events
 */
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
 * Union type of all events
 */
export type SocketEvent =
  | ProvisioningEvent
  | ChannelSyncEvent
  | ChatEvent
  | MessageEvent
  | TypingEvent;

/**
 * Redis channel names
 */
export const REDIS_CHANNELS = {
  PROVISIONING: "tenant:provisioning",
  CHANNEL_SYNC: "channel:sync",
  CHAT: "chat:events",
  MESSAGE: "message:events",
  TYPING: "typing:events",
} as const;

/**
 * Socket.io authenticated user data
 */
export interface SocketData {
  userId?: string;
  userEmail?: string;
  organizationIds?: string[];
}
