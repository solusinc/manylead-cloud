/**
 * @manylead/bright-data
 *
 * Bright Data proxy integration for per-organization WhatsApp automation.
 *
 * Features:
 * - Sticky sessions (same IP per organization)
 * - Automatic IP rotation on failure
 * - Geolocation-based routing
 * - Health monitoring
 * - Keep-alive management
 *
 * @example
 * ```typescript
 * import { getBrightDataClient } from "@manylead/bright-data";
 *
 * const brightData = getBrightDataClient();
 * const proxyConfig = brightData.getProxyConfig(
 *   organizationId,
 *   settings,
 *   timezone
 * );
 *
 * await evolutionAPI.proxy.set(instanceName, proxyConfig);
 * ```
 */

// Main client
export { BrightDataClient, getBrightDataClient } from "./client";

// Utility functions
export { buildEvolutionProxyConfig, buildRotatedProxyConfig, buildProxyFieldsForCreate } from "./utils/proxy-builder";
export { getCountryFromTimezone } from "./utils/timezone-to-country";
export {
  generateSessionId,
  buildUsername,
  isSessionValid,
  needsSessionRotation,
} from "./utils/session-manager";

// Types
export type {
  ProxyCountry,
  ProxyProtocol,
  OrganizationProxySettings,
  EvolutionProxyConfig,
  BrightDataConnection,
  SessionConfig,
  ProxyHealthStatus,
} from "./types";

// Configuration
export { env } from "./env";
export { BRIGHT_DATA_CONFIG, KEEPALIVE_CONFIG } from "./config";
