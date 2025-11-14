/**
 * WhatsApp Provider Interface
 * Abstraction layer for different WhatsApp integration methods
 */

export interface SendMessageInput {
  /** Text message content */
  text?: string;
  /** Media attachment */
  media?: {
    type: "image" | "video" | "document" | "audio";
    url: string;
    caption?: string;
    filename?: string;
  };
}

export interface SendMessageResult {
  /** Message ID from WhatsApp */
  messageId: string;
  /** Timestamp when message was sent */
  timestamp: Date;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base interface that all WhatsApp providers must implement
 */
export interface WhatsAppProvider {
  /**
   * Send a message to a WhatsApp number
   *
   * @param to - Phone number in E.164 format (+5521984848843)
   * @param input - Message content (text or media)
   * @returns Result with message ID and timestamp
   */
  sendMessage(to: string, input: SendMessageInput): Promise<SendMessageResult>;

  /**
   * Validate provider configuration
   * @returns True if configuration is valid and provider is ready
   */
  validateConfig(): Promise<boolean>;

  /**
   * Get provider type identifier
   * @returns Provider type (e.g., "baileys", "cloud_api")
   */
  getProviderType(): string;
}
