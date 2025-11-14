import { PROVIDER_TYPES } from "@manylead/shared";

import type {
  SendMessageInput,
  SendMessageResult,
  WhatsAppProvider,
} from "./base";

/**
 * Baileys Provider
 * Wrapper for Baileys session manager
 * Note: Actual Baileys integration lives in apps/worker
 */
export class BaileysProvider implements WhatsAppProvider {
  constructor(private sessionManager: BaileysSessionManagerInterface) {}

  async sendMessage(
    to: string,
    input: SendMessageInput,
  ): Promise<SendMessageResult> {
    // Delegate to session manager (in worker)
    if (input.text) {
      await this.sessionManager.sendMessage(to, input.text);
    }

    // Baileys doesn't return message IDs the same way as official API
    // Generate a local ID for tracking
    return {
      messageId: `baileys_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      metadata: {
        provider: "baileys",
        sessionId: this.sessionManager.channelId,
      },
    };
  }

  validateConfig(): Promise<boolean> {
    return Promise.resolve(this.sessionManager.isSessionConnected());
  }

  getProviderType(): string {
    return PROVIDER_TYPES.BAILEYS;
  }
}

/**
 * Interface for Baileys Session Manager
 * Actual implementation is in apps/worker/src/services/baileys
 */
export interface BaileysSessionManagerInterface {
  channelId: string;
  sendMessage(to: string, text: string): Promise<void>;
  isSessionConnected(): boolean;
}
