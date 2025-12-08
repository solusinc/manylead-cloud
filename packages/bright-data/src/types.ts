/**
 * Bright Data Proxy Types
 *
 * Per-organization proxy system using Bright Data Residential Proxies
 * for WhatsApp automation via Evolution API.
 */

/**
 * Supported countries for Bright Data proxy geolocation
 */
export type ProxyCountry =
  | "br"   // Brazil
  | "us"   // United States
  | "ar"   // Argentina
  | "cl"   // Chile
  | "mx"   // Mexico
  | "co"   // Colombia
  | "pe"   // Peru
  | "pt"   // Portugal
  | "es";  // Spain

/**
 * Proxy protocol supported by Evolution API
 */
export type ProxyProtocol = "http" | "https" | "socks5";

/**
 * Per-organization proxy settings (stored in organizationSettings.proxySettings)
 */
export interface OrganizationProxySettings {
  enabled: boolean;
  country?: ProxyCountry;
  sessionId?: string;          // UUID for sticky session (glob_ prefix)
  lastKeepAliveAt?: string;    // ISO timestamp of last keep-alive ping
  rotationCount?: number;      // Number of IP rotations performed
  lastRotatedAt?: string;      // ISO timestamp of last rotation
}

/**
 * Evolution API proxy configuration format
 *
 * This is what we send to Evolution API /proxy/set/{instanceName}
 */
export interface EvolutionProxyConfig {
  enabled: boolean;
  host?: string;
  port?: string;
  protocol?: ProxyProtocol;
  username?: string;  // Format: brd-customer-X-zone-Y-session-Z-country-W
  password?: string;
}

/**
 * Bright Data connection parameters
 */
export interface BrightDataConnection {
  customerId: string;
  zone: string;
  password: string;
  host: string;
  port: number;
}

/**
 * Session configuration for sticky IP
 */
export interface SessionConfig {
  organizationId: string;
  sessionId: string;
  country: ProxyCountry;
  isNewSession?: boolean;
}

/**
 * Proxy health status per organization
 */
export interface ProxyHealthStatus {
  isHealthy: boolean;
  lastCheckAt: Date;
  consecutiveFailures: number;
  lastError?: string;
  currentIp?: string;
}
