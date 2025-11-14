/**
 * Normalizes a phone number by removing all non-digit characters
 *
 * @param phone - Phone number in any format
 * @returns Phone number with only digits
 *
 * @example
 * ```ts
 * normalizePhoneNumber("+55 (21) 98484-8843") // "5521984848843"
 * normalizePhoneNumber("+1-555-123-4567") // "15551234567"
 * ```
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formats a phone number to E.164 format (international standard)
 *
 * @param phone - Phone number with or without country code
 * @param defaultCountryCode - Default country code if not present (e.g., "55" for Brazil)
 * @returns Phone number in E.164 format (+XXXXXXXXXXX)
 *
 * @example
 * ```ts
 * formatToE164("21984848843", "55") // "+5521984848843"
 * formatToE164("+5521984848843") // "+5521984848843"
 * formatToE164("5521984848843") // "+5521984848843"
 * ```
 */
export function formatToE164(
  phone: string,
  defaultCountryCode?: string,
): string {
  const normalized = normalizePhoneNumber(phone);

  // Already has country code (starts with digit, not 0)
  if (normalized.length >= 10 && !normalized.startsWith("0")) {
    return `+${normalized}`;
  }

  // Add default country code if provided
  if (defaultCountryCode) {
    const countryCode = normalizePhoneNumber(defaultCountryCode);
    return `+${countryCode}${normalized}`;
  }

  // Return as-is with + prefix
  return `+${normalized}`;
}

/**
 * Converts phone number to WhatsApp JID format
 *
 * @param phone - Phone number in any format
 * @returns WhatsApp JID (e.g., "5521984848843@s.whatsapp.net")
 *
 * @example
 * ```ts
 * toWhatsAppJID("+55 21 98484-8843") // "5521984848843@s.whatsapp.net"
 * ```
 */
export function toWhatsAppJID(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `${normalized}@s.whatsapp.net`;
}

/**
 * Validates if phone number is in valid E.164 format
 *
 * @param phone - Phone number to validate
 * @returns True if valid E.164 format
 *
 * @example
 * ```ts
 * isValidE164("+5521984848843") // true
 * isValidE164("21984848843") // false
 * isValidE164("+1234") // false (too short)
 * ```
 */
export function isValidE164(phone: string): boolean {
  // E.164: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone);
}
