/**
 * Worker-specific types
 */

/**
 * Worker identification
 */
export interface WorkerInfo {
  /** Unique worker ID (e.g., worker_12345_1234567890) */
  id: string;
  /** Worker process PID */
  pid: number;
  /** Worker start time */
  startedAt: Date;
}

/**
 * Session health status
 */
export interface SessionHealth {
  /** Channel ID */
  channelId: string;
  /** Worker ID that owns this session */
  workerId: string;
  /** Is session currently connected */
  isConnected: boolean;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date;
  /** Connection attempts count */
  connectionAttempts: number;
}
