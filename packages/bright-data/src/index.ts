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
 * - Database-driven zone configuration (no env vars needed)
 *
 * @example
 * ```typescript
 * import { getBrightDataClient } from "@manylead/bright-data";
 *
 * const brightData = getBrightDataClient();
 * const proxyConfig = await brightData.getProxyConfig(
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
  buildIspUsername,
  isSessionValid,
  needsSessionRotation,
} from "./utils/session-manager";

// Configuration (database-driven)
export {
  getBrightDataConfig,
  isProxyTypeConfigured,
  clearZoneCache,
  getAllActiveZones,
  KEEPALIVE_CONFIG,
} from "./config";

// IP Manager (auto-scaling ISP)
export {
  ensureIspIpAvailable,
  syncPoolSize,
  getZoneIpCount,
  addIpsToZone,
} from "./services/ip-manager";

// IP Allocation (dedicated IPs)
export {
  allocateIp,
  releaseIp,
  getIpAllocation,
} from "./services/ip-allocation";

// Environment
export { env } from "./env";

// Types
export type {
  ProxyType,
  ProxyCountry,
  ProxyProtocol,
  OrganizationProxySettings,
  EvolutionProxyConfig,
  BrightDataConnection,
  SessionConfig,
  ProxyHealthStatus,
} from "./types";
