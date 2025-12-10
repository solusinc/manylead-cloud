/**
 * Bright Data Client
 *
 * Singleton client for managing proxy configurations, health monitoring,
 * and session keep-alive for per-organization WhatsApp proxy routing.
 */

import type { Logger } from "@manylead/clients/logger";
import { createLogger } from "@manylead/clients/logger";
import type { CircuitBreaker } from "@manylead/clients";
import { createCircuitBreaker } from "@manylead/clients";
import type {
  EvolutionProxyConfig,
  OrganizationProxySettings,
  ProxyHealthStatus,
} from "./types";
import { buildEvolutionProxyConfig, buildRotatedProxyConfig } from "./utils/proxy-builder";
import { KEEPALIVE_CONFIG } from "./config";

/**
 * Bright Data Client
 *
 * Manages proxy configuration, health monitoring, and session keep-alive
 * for per-organization WhatsApp proxy routing.
 *
 * @example
 * ```typescript
 * const client = getBrightDataClient();
 *
 * // Get proxy config for an organization
 * const config = client.getProxyConfig(
 *   "org123",
 *   { enabled: true, country: "br" },
 *   "America/Sao_Paulo"
 * );
 *
 * // Rotate IP if current fails
 * const { config: newConfig, newSessionId } = client.rotateProxy(
 *   "org123",
 *   settings
 * );
 * ```
 */
export class BrightDataClient {
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;
  private healthStatus = new Map<string, ProxyHealthStatus>();

  constructor() {
    this.logger = createLogger({ component: "BrightData" });
    this.circuitBreaker = createCircuitBreaker(
      "bright-data-proxy",
      {
        threshold: 3, // Open after 3 consecutive failures
        timeout: 60000, // 1 minute before half-open
        resetTimeout: 30000, // 30 seconds success before close
      },
      this.logger,
    );
  }

  /**
   * Get Evolution API proxy configuration for an organization
   *
   * @param organizationId - Organization UUID
   * @param settings - Current proxy settings from organizationSettings.proxySettings
   * @param timezone - Organization timezone (optional)
   * @returns Evolution proxy configuration
   */
  async getProxyConfig(
    organizationId: string,
    settings: OrganizationProxySettings,
    timezone?: string,
  ): Promise<EvolutionProxyConfig> {
    return buildEvolutionProxyConfig(organizationId, settings, timezone);
  }

  /**
   * Get rotated proxy config (new IP)
   *
   * Call this when current proxy fails (e.g., 502 from Bright Data)
   *
   * @param organizationId - Organization UUID
   * @param settings - Current proxy settings
   * @param timezone - Organization timezone (optional)
   * @returns New proxy config with fresh session ID and rotation count
   */
  async rotateProxy(
    organizationId: string,
    settings: OrganizationProxySettings,
    timezone?: string,
  ): Promise<{ config: EvolutionProxyConfig; newSessionId: string; rotationCount: number }> {
    const rotationCount = (settings.rotationCount ?? 0) + 1;
    const { config, newSessionId } = await buildRotatedProxyConfig(
      organizationId,
      settings,
      timezone,
    );

    this.logger.info(
      { organizationId, rotationCount, newSessionId },
      "Proxy IP rotated",
    );

    return { config, newSessionId, rotationCount };
  }

  /**
   * Record proxy health check result
   *
   * @param organizationId - Organization UUID
   * @param isHealthy - Whether health check passed
   * @param error - Error message if failed
   * @param currentIp - Current IP address
   * @returns Updated health status
   */
  recordHealthCheck(
    organizationId: string,
    isHealthy: boolean,
    error?: string,
    currentIp?: string,
  ): ProxyHealthStatus {
    const existing = this.healthStatus.get(organizationId);

    const status: ProxyHealthStatus = {
      isHealthy,
      lastCheckAt: new Date(),
      consecutiveFailures: isHealthy ? 0 : (existing?.consecutiveFailures ?? 0) + 1,
      lastError: error,
      currentIp,
    };

    this.healthStatus.set(organizationId, status);

    if (!isHealthy && status.consecutiveFailures >= 3) {
      this.logger.warn(
        { organizationId, consecutiveFailures: status.consecutiveFailures },
        "Proxy health degraded - consider rotation",
      );
    }

    return status;
  }

  /**
   * Get health status for an organization
   *
   * @param organizationId - Organization UUID
   * @returns Health status or undefined if never checked
   */
  getHealthStatus(organizationId: string): ProxyHealthStatus | undefined {
    return this.healthStatus.get(organizationId);
  }

  /**
   * Check if session needs keep-alive ping
   *
   * @param lastKeepAliveAt - ISO timestamp of last keep-alive
   * @returns True if needs keep-alive
   */
  needsKeepAlive(lastKeepAliveAt: string | undefined): boolean {
    if (!lastKeepAliveAt) return true;

    const lastPing = new Date(lastKeepAliveAt).getTime();
    const now = Date.now();

    return now - lastPing >= KEEPALIVE_CONFIG.intervalMs;
  }

  /**
   * Get circuit breaker state
   *
   * @returns Current circuit state
   */
  getCircuitState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Check if proxy is available (circuit not open)
   *
   * @returns True if proxy is available
   */
  isProxyAvailable(): boolean {
    return this.circuitBreaker.isAvailable();
  }

  /**
   * Execute function with circuit breaker protection
   *
   * @param fn - Function to execute
   * @returns Result of function
   */
  async executeWithCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(fn);
  }
}

// Singleton instance
let brightDataClient: BrightDataClient | null = null;

/**
 * Get or create BrightDataClient singleton
 *
 * @returns BrightDataClient singleton instance
 */
export function getBrightDataClient(): BrightDataClient {
  brightDataClient ??= new BrightDataClient();
  return brightDataClient;
}
