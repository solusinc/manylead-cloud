import type {
  CheckWhatsAppNumbersResponse,
  SendPresenceRequest,
  SendPresenceResponse,
} from "../types";

export class ChatMethods {
  constructor(
    private request: <T>(
      method: string,
      path: string,
      body?: unknown,
    ) => Promise<T>,
  ) {}

  /**
   * Send presence indicator to WhatsApp contact
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/send-presence
   *
   * @param instanceName - Evolution instance name
   * @param params - Presence parameters
   * @returns Response from Evolution API
   */
  async sendPresence(
    instanceName: string,
    params: SendPresenceRequest,
  ): Promise<SendPresenceResponse> {
    return this.request<SendPresenceResponse>(
      "POST",
      `/chat/sendPresence/${instanceName}`,
      params,
    );
  }

  /**
   * Check if phone numbers are registered on WhatsApp
   * https://doc.evolution-api.com/v2/api-reference/chat-controller/check-is-whatsapp
   *
   * @param instanceName - Evolution instance name
   * @param numbers - Array of phone numbers to check (with country code, e.g., "5511999999999")
   * @returns Array of WhatsApp number check results
   * @example
   * ```typescript
   * const result = await client.chat.checkWhatsappNumbers("instance", ["5511999999999"]);
   * // Returns: [{ exists: true, jid: "5511999999999@s.whatsapp.net", number: "5511999999999" }]
   * ```
   */
  async checkWhatsappNumbers(
    instanceName: string,
    numbers: string[],
  ): Promise<CheckWhatsAppNumbersResponse> {
    return this.request<CheckWhatsAppNumbersResponse>(
      "POST",
      `/chat/whatsappNumbers/${instanceName}`,
      { numbers },
    );
  }
}
