/**
 * WhatsApp provider types
 */
export const PROVIDER_TYPES = {
  /** Baileys (QR Code) - Web scraping */
  BAILEYS: "baileys",
} as const;

export type ProviderType = (typeof PROVIDER_TYPES)[keyof typeof PROVIDER_TYPES];
