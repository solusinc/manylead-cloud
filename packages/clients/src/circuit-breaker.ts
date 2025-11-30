/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to a failing service
 * and allowing it time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are blocked
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   threshold: 5,      // Open after 5 failures
 *   timeout: 60000,    // Try again after 1 minute
 *   resetTimeout: 10000 // Back to CLOSED after 10s success
 * });
 *
 * const result = await breaker.execute(() => api.call());
 * ```
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures before opening circuit
   * @default 5
   */
  threshold?: number;

  /**
   * Time in milliseconds to wait before attempting recovery (HALF_OPEN)
   * @default 60000 (1 minute)
   */
  timeout?: number;

  /**
   * Time in milliseconds of successful operations before closing circuit
   * @default 10000 (10 seconds)
   */
  resetTimeout?: number;

  /**
   * Optional callback when circuit state changes
   */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState,
    public readonly stats: CircuitBreakerStats,
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 5;
    this.timeout = options.timeout ?? 60000; // 1 minute
    this.resetTimeout = options.resetTimeout ?? 10000; // 10 seconds
    this.onStateChange = options.onStateChange;
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - Async function to execute
   * @returns Result of the function
   * @throws CircuitBreakerError if circuit is OPEN
   * @throws Original error if function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if we should attempt transition from OPEN to HALF_OPEN
    if (this.state === "OPEN") {
      if (Date.now() - (this.lastFailureTime ?? 0) > this.timeout) {
        this.transitionTo("HALF_OPEN");
      } else {
        throw new CircuitBreakerError(
          "Circuit breaker is OPEN - service is unavailable",
          this.state,
          this.getStats(),
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    // If we're in HALF_OPEN and have enough successes, close the circuit
    if (this.state === "HALF_OPEN") {
      const successDuration = this.lastSuccessTime - (this.lastFailureTime ?? 0);
      if (successDuration >= this.resetTimeout) {
        this.transitionTo("CLOSED");
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.successes = 0;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    // Open circuit if threshold exceeded
    if (
      this.state === "CLOSED" &&
      this.failures >= this.threshold
    ) {
      this.transitionTo("OPEN");
    }

    // If HALF_OPEN and we fail, go back to OPEN
    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    this.state = newState;

    // Reset counters on state transition
    if (newState === "CLOSED") {
      this.failures = 0;
      this.successes = 0;
    }

    // Notify listeners
    this.onStateChange?.(oldState, newState);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset circuit breaker to CLOSED state
   * Use with caution - typically for admin/testing purposes
   */
  reset(): void {
    this.transitionTo("CLOSED");
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable(): boolean {
    if (this.state === "OPEN") {
      // Check if enough time has passed to try HALF_OPEN
      return Date.now() - (this.lastFailureTime ?? 0) > this.timeout;
    }
    return true;
  }
}

/**
 * Create a circuit breaker with logging
 */
export function createCircuitBreaker(
  name: string,
  options: CircuitBreakerOptions = {},
  logger?: {
    info: (msg: string, data?: unknown) => void;
    warn: (msg: string, data?: unknown) => void;
    error: (msg: string, data?: unknown) => void;
  },
): CircuitBreaker {
  return new CircuitBreaker({
    ...options,
    onStateChange: (from, to) => {
      logger?.warn(`Circuit breaker "${name}" state changed: ${from} → ${to}`);
      options.onStateChange?.(from, to);
    },
  });
}
