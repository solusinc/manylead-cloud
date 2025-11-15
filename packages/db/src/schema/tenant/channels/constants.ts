/**
 * Channel Type
 * - qr_code: Canal não oficial via QR Code (WhatsApp Web)
 * - official: Canal oficial via WhatsApp Business API
 */
export const CHANNEL_TYPE = {
  QR_CODE: "qr_code",
  OFFICIAL: "official",
} as const;

export type ChannelType = (typeof CHANNEL_TYPE)[keyof typeof CHANNEL_TYPE];

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

/**
 * Evolution Connection State
 */
export const EVOLUTION_STATE = {
  OPEN: "open",
  CLOSE: "close",
  CONNECTING: "connecting",
} as const;

export type EvolutionState =
  (typeof EVOLUTION_STATE)[keyof typeof EVOLUTION_STATE];
