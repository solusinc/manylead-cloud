import type { Redis } from "ioredis";
import { CHANNEL_LIMITS } from "@manylead/shared";

import type { SessionHealth } from "../../types";

/**
 * Distributed Session Registry
 * Uses Redis to track which worker owns which Baileys session
 * Enables horizontal scaling of workers
 */
export class DistributedSessionRegistry {
  constructor(
    private redis: Redis,
    private workerId: string,
  ) {}

  /**
   * Register a session as owned by this worker
   *
   * @param channelId - Channel ID
   */
  async registerSession(channelId: string): Promise<void> {
    // Register in Redis hash (channel -> worker mapping)
    await this.redis.hset("sessions:registry", channelId, this.workerId);

    // Set heartbeat with TTL
    await this.redis.setex(
      `session:${channelId}:heartbeat`,
      CHANNEL_LIMITS.SESSION_REGISTRY_TTL_SECONDS,
      Date.now().toString(),
    );
  }

  /**
   * Get the worker ID that owns a session
   *
   * @param channelId - Channel ID
   * @returns Worker ID or null if session not registered
   */
  async getSessionWorker(channelId: string): Promise<string | null> {
    // Check if session exists in registry
    const workerId = await this.redis.hget("sessions:registry", channelId);

    if (!workerId) return null;

    // Check if heartbeat is recent (session is alive)
    const heartbeat = await this.redis.get(`session:${channelId}:heartbeat`);

    if (!heartbeat) {
      // Stale session (heartbeat expired), remove it
      await this.unregisterSession(channelId);
      return null;
    }

    return workerId;
  }

  /**
   * Unregister a session
   *
   * @param channelId - Channel ID
   */
  async unregisterSession(channelId: string): Promise<void> {
    await this.redis.hdel("sessions:registry", channelId);
    await this.redis.del(`session:${channelId}:heartbeat`);
  }

  /**
   * Acquire a distributed lock for a channel
   * Prevents multiple workers from starting the same session simultaneously
   *
   * @param channelId - Channel ID
   * @param ttl - Lock TTL in seconds (default: 30)
   * @returns True if lock acquired, false otherwise
   */
  async acquireLock(channelId: string, ttl?: number): Promise<boolean> {
    const lockTtl = ttl ?? CHANNEL_LIMITS.DISTRIBUTED_LOCK_TTL_SECONDS;

    const result = await this.redis.set(
      `lock:channel:${channelId}`,
      this.workerId,
      "EX",
      lockTtl,
      "NX",
    );

    return result === "OK";
  }

  /**
   * Release a distributed lock
   *
   * @param channelId - Channel ID
   */
  async releaseLock(channelId: string): Promise<void> {
    // Only release if this worker owns the lock
    const currentLock = await this.redis.get(`lock:channel:${channelId}`);

    if (currentLock === this.workerId) {
      await this.redis.del(`lock:channel:${channelId}`);
    }
  }

  /**
   * Update heartbeat for a session
   * Should be called periodically to indicate session is alive
   *
   * @param channelId - Channel ID
   */
  async updateHeartbeat(channelId: string): Promise<void> {
    await this.redis.setex(
      `session:${channelId}:heartbeat`,
      CHANNEL_LIMITS.SESSION_REGISTRY_TTL_SECONDS,
      Date.now().toString(),
    );
  }

  /**
   * Get health information for a session
   *
   * @param channelId - Channel ID
   * @returns Session health or null if not found
   */
  async getSessionHealth(channelId: string): Promise<SessionHealth | null> {
    const workerId = await this.redis.hget("sessions:registry", channelId);
    if (!workerId) return null;

    const heartbeat = await this.redis.get(`session:${channelId}:heartbeat`);
    if (!heartbeat) return null;

    const lastHeartbeat = new Date(parseInt(heartbeat, 10));
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();

    return {
      channelId,
      workerId,
      isConnected: timeSinceHeartbeat < 60_000, // Connected if heartbeat < 1 min ago
      lastHeartbeat,
      connectionAttempts: 0, // TODO: Track this in Redis
    };
  }

  /**
   * Get all active sessions for this worker
   *
   * @returns Array of channel IDs
   */
  async getWorkerSessions(): Promise<string[]> {
    const allSessions = await this.redis.hgetall("sessions:registry");

    return Object.entries(allSessions)
      .filter(([, workerId]) => workerId === this.workerId)
      .map(([channelId]) => channelId);
  }

  /**
   * Get all active sessions across all workers
   *
   * @returns Map of channelId -> workerId
   */
  async getAllSessions(): Promise<Map<string, string>> {
    const allSessions = await this.redis.hgetall("sessions:registry");
    return new Map(Object.entries(allSessions));
  }
}
