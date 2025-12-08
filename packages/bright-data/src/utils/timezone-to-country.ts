/**
 * Timezone to Country Mapping
 *
 * Maps IANA timezone identifiers to Bright Data country codes
 * for automatic geolocation based on organization timezone.
 */

import type { ProxyCountry } from "../types";

/**
 * Map timezone to Bright Data country code
 *
 * Strategy: Match the most common timezone prefixes to their
 * respective country codes for optimal proxy routing
 */
const TIMEZONE_TO_COUNTRY: Record<string, ProxyCountry> = {
  // Brazil timezones
  "America/Sao_Paulo": "br",
  "America/Rio_Branco": "br",
  "America/Manaus": "br",
  "America/Cuiaba": "br",
  "America/Fortaleza": "br",
  "America/Recife": "br",
  "America/Bahia": "br",
  "America/Belem": "br",
  "America/Maceio": "br",
  "America/Campo_Grande": "br",
  "America/Santarem": "br",
  "America/Porto_Velho": "br",
  "America/Boa_Vista": "br",
  "America/Araguaina": "br",
  "America/Noronha": "br",

  // Argentina
  "America/Buenos_Aires": "ar",
  "America/Argentina/Buenos_Aires": "ar",
  "America/Argentina/Cordoba": "ar",
  "America/Argentina/Salta": "ar",
  "America/Argentina/Jujuy": "ar",
  "America/Argentina/Tucuman": "ar",
  "America/Argentina/Catamarca": "ar",
  "America/Argentina/La_Rioja": "ar",
  "America/Argentina/San_Juan": "ar",
  "America/Argentina/Mendoza": "ar",
  "America/Argentina/San_Luis": "ar",
  "America/Argentina/Rio_Gallegos": "ar",
  "America/Argentina/Ushuaia": "ar",

  // Chile
  "America/Santiago": "cl",
  "Pacific/Easter": "cl",

  // Mexico
  "America/Mexico_City": "mx",
  "America/Cancun": "mx",
  "America/Monterrey": "mx",
  "America/Tijuana": "mx",
  "America/Hermosillo": "mx",
  "America/Mazatlan": "mx",
  "America/Chihuahua": "mx",
  "America/Merida": "mx",

  // Colombia
  "America/Bogota": "co",

  // Peru
  "America/Lima": "pe",

  // Portugal
  "Europe/Lisbon": "pt",
  "Atlantic/Madeira": "pt",
  "Atlantic/Azores": "pt",

  // Spain
  "Europe/Madrid": "es",
  "Africa/Ceuta": "es",
  "Atlantic/Canary": "es",

  // United States (fallback for most Americas)
  "America/New_York": "us",
  "America/Los_Angeles": "us",
  "America/Chicago": "us",
  "America/Denver": "us",
  "America/Phoenix": "us",
  "America/Detroit": "us",
  "America/Anchorage": "us",
  "Pacific/Honolulu": "us",
};

/**
 * Get country code from timezone
 *
 * @param timezone - IANA timezone string (e.g., "America/Sao_Paulo")
 * @returns ProxyCountry or "br" as default
 *
 * @example
 * ```typescript
 * getCountryFromTimezone("America/Sao_Paulo") // => "br"
 * getCountryFromTimezone("America/Buenos_Aires") // => "ar"
 * getCountryFromTimezone("Unknown") // => "br" (default)
 * ```
 */
export function getCountryFromTimezone(timezone: string): ProxyCountry {
  // Direct match
  const directMatch = TIMEZONE_TO_COUNTRY[timezone];
  if (directMatch) {
    return directMatch;
  }

  // Fallback by continent/region patterns
  if (timezone.startsWith("America/")) {
    // South America defaults to Brazil (largest market)
    if (timezone.includes("Argentina")) return "ar";
    if (timezone.includes("Santiago")) return "cl";
    if (timezone.includes("Lima")) return "pe";
    if (timezone.includes("Bogota")) return "co";
    if (timezone.includes("Mexico")) return "mx";

    // Default Brazil for other South American timezones
    return "br";
  }

  if (timezone.startsWith("Europe/")) {
    if (timezone.includes("Lisbon")) return "pt";
    if (timezone.includes("Madrid")) return "es";

    // Default Portugal for other European timezones
    return "pt";
  }

  // Ultimate fallback: Brazil (largest market + most orgs)
  return "br";
}
