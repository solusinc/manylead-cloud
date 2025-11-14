/**
 * Channel Status
 */
export const CHANNEL_STATUS = {
  PENDING: "pending",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error",
} as const;

export type ChannelStatus =
  (typeof CHANNEL_STATUS)[keyof typeof CHANNEL_STATUS];
