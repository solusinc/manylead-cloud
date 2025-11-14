/**
 * Channel operation limits and timeouts
 */
export const CHANNEL_LIMITS = {
  /** Maximum reconnection attempts before giving up */
  MAX_RECONNECT_ATTEMPTS: 10,

  /** Heartbeat interval for session registry (ms) */
  HEARTBEAT_INTERVAL_MS: 30_000, // 30 seconds

  /** Queue job timeout (ms) */
  QUEUE_TIMEOUT_MS: 120_000, // 2 minutes

  /** Connection wait timeout (ms) */
  CONNECTION_WAIT_TIMEOUT_MS: 30_000, // 30 seconds

  /** QR code expiration time (ms) */
  QR_CODE_EXPIRATION_MS: 60_000, // 1 minute

  /** Distributed lock TTL (seconds) */
  DISTRIBUTED_LOCK_TTL_SECONDS: 30,

  /** Auth state write batch delay (ms) */
  AUTH_STATE_BATCH_DELAY_MS: 1_000, // 1 second

  /** Session registry heartbeat TTL (seconds) */
  SESSION_REGISTRY_TTL_SECONDS: 60,
} as const;
