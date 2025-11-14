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
 * Channel QR Code events
 */
export interface ChannelQREvent {
  type: "channel:qr-updated" | "channel:connected" | "channel:disconnected" | "channel:error";
  organizationId: string;
  channelId: string;
  data: {
    qrCode?: string;
    expiresAt?: string;
    status?: string;
    error?: string;
  };
}

/**
 * Union type of all events
 */
export type SocketEvent = ProvisioningEvent | ChannelQREvent;

/**
 * Redis channel names
 */
export const REDIS_CHANNELS = {
  PROVISIONING: "tenant:provisioning",
  CHANNELS: "channels:events",
} as const;

/**
 * Socket.io authenticated user data
 */
export interface SocketData {
  userId?: string;
  userEmail?: string;
  organizationIds?: string[];
}
