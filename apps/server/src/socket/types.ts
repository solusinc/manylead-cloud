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
 * Union type of all events
 */
export type SocketEvent = ProvisioningEvent | ChannelSyncEvent;

/**
 * Redis channel names
 */
export const REDIS_CHANNELS = {
  PROVISIONING: "tenant:provisioning",
  CHANNEL_SYNC: "channel:sync",
} as const;

/**
 * Socket.io authenticated user data
 */
export interface SocketData {
  userId?: string;
  userEmail?: string;
  organizationIds?: string[];
}
