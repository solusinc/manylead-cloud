/**
 * Proxy Zones Constants
 */

/**
 * Proxy type - ISP (dedicated IPs) or Residential (dynamic IPs)
 */
export const proxyType = ["isp", "residential"] as const;
export type ProxyType = (typeof proxyType)[number];

/**
 * Supported countries for proxy zones
 */
export const proxyCountry = [
  "br", // Brazil
  "us", // United States
  "ca", // Canada
  "ar", // Argentina
  "cl", // Chile
  "mx", // Mexico
  "co", // Colombia
  "pe", // Peru
  "pt", // Portugal
  "es", // Spain
  "gb", // United Kingdom
  "de", // Germany
  "fr", // France
] as const;
export type ProxyCountry = (typeof proxyCountry)[number];

/**
 * Proxy zone status
 */
export const proxyZoneStatus = ["active", "inactive", "suspended"] as const;
export type ProxyZoneStatus = (typeof proxyZoneStatus)[number];
