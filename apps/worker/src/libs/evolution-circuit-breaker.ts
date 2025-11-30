import { createCircuitBreaker } from "@manylead/clients";
import { createLogger } from "~/libs/utils/logger";

const logger = createLogger("Worker:Evolution:CircuitBreaker");

/**
 * Circuit breaker for Evolution API
 *
 * Protects the system from cascading failures when Evolution API is down.
 * Configuration:
 * - Threshold: 5 consecutive failures
 * - Timeout: 60 seconds before retry
 * - Reset: 10 seconds of success to close circuit
 */
export const evolutionCircuitBreaker = createCircuitBreaker(
  "Evolution API",
  {
    threshold: 5, // Open after 5 failures
    timeout: 60000, // Wait 1 minute before retrying
    resetTimeout: 10000, // Close after 10s of success
    onStateChange: (from, to) => {
      logger.warn(
        { from, to, stats: evolutionCircuitBreaker.getStats() },
        `Evolution API circuit breaker: ${from} → ${to}`,
      );
    },
  },
  logger,
);

/**
 * Check if Evolution API is available
 */
export function isEvolutionAPIAvailable(): boolean {
  return evolutionCircuitBreaker.isAvailable();
}

/**
 * Get Evolution API circuit breaker stats
 */
export function getEvolutionAPIStats() {
  return evolutionCircuitBreaker.getStats();
}
