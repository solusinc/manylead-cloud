/**
 * Proxy Builder
 *
 * Builds Evolution API proxy configurations from organization settings
 * and Bright Data credentials. Supports both Residential and ISP proxy types.
 */

import type {
  EvolutionProxyConfig,
  OrganizationProxySettings,
  ProxyCountry,
  ProxyType,
  SessionConfig,
} from "../types";
import { getBrightDataConfig, KEEPALIVE_CONFIG } from "../config";
import { buildUsername, buildIspUsername, generateSessionId, needsSessionRotation } from "./session-manager";
import { getCountryFromTimezone } from "./timezone-to-country";

/**
 * Build proxy fields for CREATE instance (without "enabled" field)
 *
 * @param organizationId - Organization UUID
 * @param settings - Current proxy settings
 * @param timezone - Organization timezone (optional)
 * @returns Proxy fields for instance creation (proxyHost, proxyPort, etc)
 */
export async function buildProxyFieldsForCreate(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): Promise<{ proxyHost: string; proxyPort: string; proxyProtocol: string; proxyUsername: string; proxyPassword: string } | null> {
  if (!settings.enabled) {
    return null;
  }

  const proxyType: ProxyType = settings.proxyType ?? "isp";
  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  const config = await getBrightDataConfig(proxyType, country);

  if (!config) {
    return null;
  }

  // ISP: simpler username with session for sticky IP allocation
  if (proxyType === "isp") {
    const sessionId = settings.sessionId ?? generateSessionId(organizationId);
    const username = buildIspUsername(config.customerId, config.zone, sessionId);

    return {
      proxyHost: config.host,
      proxyPort: config.port.toString(),
      proxyProtocol: "http",
      proxyUsername: username,
      proxyPassword: config.password,
    };
  }

  // Residential: full session management with country
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

  const username = buildUsername(config.customerId, config.zone, sessionConfig);

  return {
    proxyHost: config.host,
    proxyPort: config.port.toString(),
    proxyProtocol: "http",
    proxyUsername: username,
    proxyPassword: config.password,
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
 */
export async function buildEvolutionProxyConfig(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): Promise<EvolutionProxyConfig> {
  if (!settings.enabled) {
    return { enabled: false };
  }

  const proxyType: ProxyType = settings.proxyType ?? "isp";
  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  const config = await getBrightDataConfig(proxyType, country);

  if (!config) {
    return { enabled: false };
  }

  // ISP: simpler username with session for sticky IP allocation
  if (proxyType === "isp") {
    const sessionId = settings.sessionId ?? generateSessionId(organizationId);
    const username = buildIspUsername(config.customerId, config.zone, sessionId);

    return {
      enabled: true,
      host: config.host,
      port: config.port.toString(),
      protocol: "http",
      username,
      password: config.password,
    };
  }

  // Residential: full session management with country
  let sessionId = settings.sessionId;
  let isNewSession = false;

  if (
    !sessionId ||
    needsSessionRotation(settings.lastKeepAliveAt, KEEPALIVE_CONFIG.sessionTimeoutMs)
  ) {
    sessionId = generateSessionId(organizationId);
    isNewSession = true;
  }

  const sessionConfig: SessionConfig = {
    organizationId,
    sessionId,
    country,
    isNewSession,
  };

  const username = buildUsername(config.customerId, config.zone, sessionConfig);

  return {
    enabled: true,
    host: config.host,
    port: config.port.toString(),
    protocol: "http",
    username,
    password: config.password,
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
 */
export async function buildRotatedProxyConfig(
  organizationId: string,
  settings: OrganizationProxySettings,
  timezone?: string,
): Promise<{ config: EvolutionProxyConfig; newSessionId: string }> {
  const proxyType: ProxyType = settings.proxyType ?? "isp";
  const country: ProxyCountry =
    settings.country ?? (timezone ? getCountryFromTimezone(timezone) : "br");

  const bdConfig = await getBrightDataConfig(proxyType, country);

  if (!bdConfig) {
    return {
      config: { enabled: false },
      newSessionId: "",
    };
  }

  const newSessionId = generateSessionId(organizationId);

  // ISP: simpler username
  if (proxyType === "isp") {
    const username = buildIspUsername(bdConfig.customerId, bdConfig.zone, newSessionId);

    return {
      config: {
        enabled: true,
        host: bdConfig.host,
        port: bdConfig.port.toString(),
        protocol: "http",
        username,
        password: bdConfig.password,
      },
      newSessionId,
    };
  }

  // Residential: full session config
  const sessionConfig: SessionConfig = {
    organizationId,
    sessionId: newSessionId,
    country,
    isNewSession: true,
  };

  const username = buildUsername(bdConfig.customerId, bdConfig.zone, sessionConfig);

  return {
    config: {
      enabled: true,
      host: bdConfig.host,
      port: bdConfig.port.toString(),
      protocol: "http",
      username,
      password: bdConfig.password,
    },
    newSessionId,
  };
}
