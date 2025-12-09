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

/**
 * Formats a Brazilian phone number to display format
 *
 * @param phone - Phone number in any format
 * @returns Formatted phone number (e.g., "+55 11 5198-8991")
 *
 * @example
 * ```ts
 * formatBrazilianPhone("5511519889991") // "+55 11 5198-8991"
 * formatBrazilianPhone("+5511519889991") // "+55 11 5198-8991"
 * formatBrazilianPhone("11519889991") // "+55 11 5198-8991"
 * ```
 */
export function formatBrazilianPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  // Remove country code if present
  const withoutCountryCode = normalized.startsWith("55")
    ? normalized.slice(2)
    : normalized;

  // Extract DDD (area code) and number
  const ddd = withoutCountryCode.slice(0, 2);
  const number = withoutCountryCode.slice(2);

  // Format based on number length
  if (number.length === 9) {
    // Mobile: 9XXXX-XXXX
    return `+55 ${ddd} ${number.slice(0, 5)}-${number.slice(5)}`;
  } else if (number.length === 8) {
    // Landline: XXXX-XXXX
    return `+55 ${ddd} ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  // Fallback: return as E.164
  return formatToE164(phone, "55");
}

/**
 * Masks the last N digits of a phone number with bullets (••••)
 *
 * @param phone - Phone number in any format
 * @param digits - Number of digits to mask (default: 4)
 * @returns Phone number with last digits masked
 *
 * @example
 * ```ts
 * maskPhoneLastDigits("+55 11 98484-8843") // "+55 11 98484-••••"
 * maskPhoneLastDigits("5511984848843", 4) // "55119848••••"
 * ```
 */
export function maskPhoneLastDigits(phone: string, digits = 4): string {
  if (phone.length <= digits) {
    return "•".repeat(phone.length);
  }
  return phone.slice(0, -digits) + "•".repeat(digits);
}
