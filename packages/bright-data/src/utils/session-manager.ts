/**
 * Session Manager
 *
 * Generates and manages sticky session IDs for per-organization proxy routing.
 * Uses Bright Data's glob_ session prefix for global sticky sessions.
 */

import { v7 as uuidv7 } from "uuid";
import type { SessionConfig } from "../types";
import { KEEPALIVE_CONFIG } from "../config";

/**
 * Generate session ID for sticky IP
 *
 * Format: glob_{organizationId}_{uuid}
 * The "glob_" prefix tells Bright Data to use sticky sessions that ignore
 * source IP (global session across all requests from same session ID)
 *
 * @param organizationId - Organization UUID
 * @returns Session ID string
 *
 * @example
 * ```typescript
 * generateSessionId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 * // => "glob_a1b2c3d4_e5f6g7h8"
 * ```
 */
export function generateSessionId(organizationId: string): string {
  // Clean org ID (remove hyphens for shorter username)
  const cleanOrgId = organizationId.replace(/-/g, "").slice(0, 8);

  // Generate short UUID for uniqueness
  const uuid = uuidv7().replace(/-/g, "").slice(0, 8);

  // Format: glob_{org}_{uuid}
  return `glob_${cleanOrgId}_${uuid}`;
}

/**
 * Build Bright Data username with session parameters
 *
 * Format: brd-customer-{customer_id}-zone-{zone}-session-{session_id}-country-{country}
 *
 * @param customerId - Bright Data customer ID
 * @param zone - Bright Data zone name
 * @param session - Session configuration
 * @returns Complete username for proxy authentication
 *
 * @example
 * ```typescript
 * buildUsername("hl_abc123", "manylead_residential", {
 *   organizationId: "org123",
 *   sessionId: "glob_a1b2c3d4_e5f6g7h8",
 *   country: "br"
 * })
 * // => "brd-customer-hl_abc123-zone-manylead_residential-session-glob_a1b2c3d4_e5f6g7h8-country-br"
 * ```
 */
export function buildUsername(
  customerId: string,
  zone: string,
  session: SessionConfig,
): string {
  const parts = [
    `brd-customer-${customerId}`,
    `zone-${zone}`,
    `session-${session.sessionId}`,
    `country-${session.country}`,
  ];

  return parts.join("-");
}

/**
 * Check if session is still valid (within timeout window)
 *
 * Bright Data sessions timeout after 7 minutes of inactivity.
 * We keep-alive every 5 minutes to maintain the session.
 *
 * @param lastKeepAliveAt - ISO timestamp of last keep-alive ping
 * @param sessionTimeoutMs - Session timeout in milliseconds
 * @returns True if session is still valid
 *
 * @example
 * ```typescript
 * isSessionValid("2025-01-01T12:00:00Z", 420000)
 * // => false (if more than 7 minutes passed)
 * ```
 */
export function isSessionValid(
  lastKeepAliveAt: string | undefined,
  sessionTimeoutMs: number,
): boolean {
  if (!lastKeepAliveAt) return false;

  const lastKeepAlive = new Date(lastKeepAliveAt).getTime();
  const now = Date.now();

  return now - lastKeepAlive < sessionTimeoutMs;
}

/**
 * Determine if session needs rotation (new session required)
 *
 * @param lastKeepAliveAt - ISO timestamp of last keep-alive ping
 * @param sessionTimeoutMs - Session timeout in milliseconds
 * @returns True if session expired and needs rotation
 */
export function needsSessionRotation(
  lastKeepAliveAt: string | undefined,
  sessionTimeoutMs: number = KEEPALIVE_CONFIG.sessionTimeoutMs,
): boolean {
  return !isSessionValid(lastKeepAliveAt, sessionTimeoutMs);
}
