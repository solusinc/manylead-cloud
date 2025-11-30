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
  type: "chat:created" | "chat:updated" | "chat:deleted" | "contact:logo:updated";
  organizationId: string;
  chatId?: string;
  targetAgentId?: string; // Para enviar evento apenas para um agent específico
  data: {
    chat?: Record<string, unknown>;
    contact?: Record<string, unknown>;
    assignedAgent?: Record<string, unknown>;
    sourceOrganizationId?: string;
    logoUrl?: string | null;
    contactsUpdated?: number;
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
  targetAgentId?: string; // Para enviar evento apenas para um agent específico (chats internos)
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
  agentIds?: Map<string, string>; // Map de organizationId -> agentId
}
