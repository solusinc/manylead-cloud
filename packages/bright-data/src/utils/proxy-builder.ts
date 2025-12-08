/**
 * Proxy Builder
 *
 * Builds Evolution API proxy configurations from organization settings
 * and Bright Data credentials.
 */

import type {
  EvolutionProxyConfig,
  OrganizationProxySettings,
  ProxyCountry,
  SessionConfig,
} from "../types";
import { BRIGHT_DATA_CONFIG, KEEPALIVE_CONFIG } from "../config";
import { buildUsername, generateSessionId, needsSessionRotation } from "./session-manager";
import { getCountryFromTimezone } from "./timezone-to-country";

/**
 * Build proxy fields for CREATE instance (without "enabled" field)
 *
 * @param organizationId - Organization UUID
 * @param settings - Current proxy settings
 * @param timezone - Organization timezone (optional)
 * @returns Proxy fields for instance creation (proxyHost, proxyPort, etc)
 */
export function buildProxyFieldsForCreate(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): { proxyHost: string; proxyPort: string; proxyProtocol: string; proxyUsername: string; proxyPassword: string } | null {
  if (!settings.enabled) {
    return null;
  }

  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  let sessionId = settings.sessionId;
  if (
    !sessionId ||
    needsSessionRotation(settings.lastKeepAliveAt, KEEPALIVE_CONFIG.sessionTimeoutMs)
  ) {
    sessionId = generateSessionId(organizationId);
  }

  const sessionConfig: SessionConfig = {
    organizationId,
    sessionId,
    country,
    isNewSession: !settings.sessionId,
  };

  const username = buildUsername(
    BRIGHT_DATA_CONFIG.customerId,
    BRIGHT_DATA_CONFIG.zone,
    sessionConfig,
  );

  return {
    proxyHost: BRIGHT_DATA_CONFIG.host,
    proxyPort: BRIGHT_DATA_CONFIG.port.toString(),
    proxyProtocol: "http",
    proxyUsername: username,
    proxyPassword: BRIGHT_DATA_CONFIG.password,
  };
}

/**
 * Build Evolution API proxy configuration for /proxy/set endpoint
 *
 * This is for setting proxy AFTER instance creation.
 * Includes the "enabled" field.
 *
 * @param organizationId - Organization UUID
 * @param settings - Current proxy settings from organizationSettings.proxySettings
 * @param timezone - Organization timezone (optional, defaults to auto-detect)
 * @returns Evolution API proxy configuration
 *
 * @example
 * ```typescript
 * const config = buildEvolutionProxyConfig(
 *   "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
 *   { enabled: true, country: "br" },
 *   "America/Sao_Paulo"
 * );
 * // Returns EvolutionProxyConfig ready to send to Evolution API
 * ```
 */
export function buildEvolutionProxyConfig(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): EvolutionProxyConfig {
  // If proxy disabled, return disabled config
  if (!settings.enabled) {
    return {
      enabled: false,
    };
  }

  // Determine country from settings or timezone
  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  // Check if we need a new session
  let sessionId = settings.sessionId;
  let isNewSession = false;

  if (
    !sessionId ||
    needsSessionRotation(settings.lastKeepAliveAt, KEEPALIVE_CONFIG.sessionTimeoutMs)
  ) {
    sessionId = generateSessionId(organizationId);
    isNewSession = true;
  }

  // Build session config
  const sessionConfig: SessionConfig = {
    organizationId,
    sessionId,
    country,
    isNewSession,
  };

  // Build username with all parameters
  const username = buildUsername(
    BRIGHT_DATA_CONFIG.customerId,
    BRIGHT_DATA_CONFIG.zone,
    sessionConfig,
  );

  return {
    enabled: true,
    host: BRIGHT_DATA_CONFIG.host,
    port: BRIGHT_DATA_CONFIG.port.toString(),
    protocol: "http" as const,
    username,
    password: BRIGHT_DATA_CONFIG.password,
  };
}

/**
 * Build proxy config for IP rotation (new session)
 *
 * Used when current IP fails (e.g., 502 error from Bright Data)
 * or when manually rotating IP.
 *
 * @param organizationId - Organization UUID
 * @param settings - Current proxy settings
 * @param timezone - Organization timezone (optional)
 * @returns New proxy config with fresh session ID
 *
 * @example
 * ```typescript
 * const { config, newSessionId } = buildRotatedProxyConfig(
 *   "org123",
 *   currentSettings,
 *   "America/Sao_Paulo"
 * );
 * // Returns new config with different IP
 * ```
 */
export function buildRotatedProxyConfig(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): { config: EvolutionProxyConfig; newSessionId: string } {
  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  // Force new session for rotation
  const newSessionId = generateSessionId(organizationId);

  const sessionConfig: SessionConfig = {
    organizationId,
    sessionId: newSessionId,
    country,
    isNewSession: true,
  };

  const username = buildUsername(
    BRIGHT_DATA_CONFIG.customerId,
    BRIGHT_DATA_CONFIG.zone,
    sessionConfig,
  );

  return {
    config: {
      enabled: true,
      host: BRIGHT_DATA_CONFIG.host,
      port: BRIGHT_DATA_CONFIG.port.toString(),
      protocol: "http",
      username,
      password: BRIGHT_DATA_CONFIG.password,
    },
    newSessionId,
  };
}
