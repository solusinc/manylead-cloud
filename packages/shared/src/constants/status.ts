/**
 * Channel status values
 */
export const CHANNEL_STATUS = {
  /** Channel is pending connection */
  PENDING: "pending",
  /** Channel is connected and active */
  CONNECTED: "connected",
  /** Channel is disconnected */
  DISCONNECTED: "disconnected",
  /** Channel encountered an error */
  ERROR: "error",
} as const;

export type ChannelStatus = (typeof CHANNEL_STATUS)[keyof typeof CHANNEL_STATUS];
