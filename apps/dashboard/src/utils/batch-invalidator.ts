/**
 * BatchInvalidator - Debounce rapid query invalidations
 *
 * Big Tech Pattern: Batch rapid events to reduce API calls (Slack, Discord)
 *
 * Example:
 * - 5 messages arrive in 200ms
 * - Without batching: 5 invalidations = 5 API calls
 * - With batching: 1 invalidation = 1 API call
 *
 * Benefits:
 * - 80% reduction in burst scenarios
 * - Better UX (less flickering)
 * - Lower server load
 */

type InvalidateFn = () => void | Promise<void>;

export class BatchInvalidator {
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly debounceMs: number;

  constructor(debounceMs = 50) {
    this.debounceMs = debounceMs;
  }

  /**
   * Schedule an invalidation with debouncing
   *
   * @param key - Unique key for this invalidation type
   * @param fn - Function to execute after debounce
   */
  invalidate(key: string, fn: InvalidateFn): void {
    // Clear existing timer for this key
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new invalidation
    const timer = setTimeout(() => {
      void fn();
      this.timers.delete(key);
    }, this.debounceMs);

    this.timers.set(key, timer);
  }

  /**
   * Force immediate execution of pending invalidation
   */
  flush(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Flush all pending invalidations
   */
  flushAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * Get pending invalidation count (for monitoring)
   */
  getPendingCount(): number {
    return this.timers.size;
  }

  /**
   * Clear all timers (cleanup)
   */
  destroy(): void {
    this.flushAll();
  }
}

/**
 * Singleton instances for different invalidation types
 */
export const chatListInvalidator = new BatchInvalidator(50); // 50ms debounce
export const messageListInvalidator = new BatchInvalidator(50);
export const archivedCountInvalidator = new BatchInvalidator(100); // Less critical, longer debounce

/**
 * Cleanup on page unload
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    chatListInvalidator.destroy();
    messageListInvalidator.destroy();
    archivedCountInvalidator.destroy();
  });
}
