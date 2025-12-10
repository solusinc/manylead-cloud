/**
 * Bright Data Configuration
 *
 * Fetches proxy zone configurations from the database.
 * Supports both Residential and ISP proxy types.
 */

import { db, proxyZone, eq, and } from "@manylead/db";
import { decrypt } from "@manylead/crypto";
import type { BrightDataConnection, ProxyType, ProxyCountry } from "./types";

/**
 * Session keep-alive configuration (for residential sessions)
 */
export const KEEPALIVE_CONFIG = {
  intervalMs: 300000,      // 5 minutes
  sessionTimeoutMs: 420000, // 7 minutes
} as const;

/**
 * Cache for proxy zone configs (avoid repeated DB queries)
 * Key: `${type}_${country}`, Value: { config, expiresAt }
 */
const zoneCache = new Map<string, { config: BrightDataConnection; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get Bright Data connection config for a specific proxy type and country
 *
 * @param type - Proxy type (isp or residential)
 * @param country - Country code (for ISP, must match zone country; for residential, optional)
 * @returns BrightDataConnection or null if not configured
 */
export async function getBrightDataConfig(
  type: ProxyType,
  country: ProxyCountry = "br",
): Promise<BrightDataConnection | null> {
  const cacheKey = `${type}_${country}`;
  const now = Date.now();

  // Check cache first
  const cached = zoneCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.config;
  }

  // Fetch from database
  const [zone] = await db
    .select()
    .from(proxyZone)
    .where(
      and(
        eq(proxyZone.type, type),
        eq(proxyZone.country, country),
        eq(proxyZone.status, "active"),
      ),
    )
    .limit(1);

  if (!zone) {
    return null;
  }

  // Decrypt password
  const password = decrypt<string>({
    encrypted: zone.passwordEncrypted,
    iv: zone.passwordIv,
    tag: zone.passwordTag,
  });

  const config: BrightDataConnection = {
    customerId: zone.customerId,
    zone: zone.zone,
    password,
    host: zone.host,
    port: zone.port,
  };

  // Cache the result
  zoneCache.set(cacheKey, {
    config,
    expiresAt: now + CACHE_TTL_MS,
  });

  return config;
}

/**
 * Check if a proxy type is configured for a country
 */
export async function isProxyTypeConfigured(
  type: ProxyType,
  country: ProxyCountry = "br",
): Promise<boolean> {
  const config = await getBrightDataConfig(type, country);
  return config !== null;
}

/**
 * Clear the zone cache (useful after zone updates)
 */
export function clearZoneCache(): void {
  zoneCache.clear();
}

/**
 * Get all active zones (for admin purposes)
 */
export async function getAllActiveZones() {
  return db
    .select({
      id: proxyZone.id,
      name: proxyZone.name,
      type: proxyZone.type,
      country: proxyZone.country,
      zone: proxyZone.zone,
      host: proxyZone.host,
      port: proxyZone.port,
      poolSize: proxyZone.poolSize,
      status: proxyZone.status,
      isDefault: proxyZone.isDefault,
      createdAt: proxyZone.createdAt,
    })
    .from(proxyZone)
    .where(eq(proxyZone.status, "active"));
}
