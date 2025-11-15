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
 * Union type of all events
 */
export type SocketEvent = ProvisioningEvent;

/**
 * Redis channel names
 */
export const REDIS_CHANNELS = {
  PROVISIONING: "tenant:provisioning",
} as const;

/**
 * Socket.io authenticated user data
 */
export interface SocketData {
  userId?: string;
  userEmail?: string;
  organizationIds?: string[];
}
