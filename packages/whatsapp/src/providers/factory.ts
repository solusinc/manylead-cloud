import { PROVIDER_TYPES } from "@manylead/shared";

import type { WhatsAppProvider } from "./base";
import type { BaileysSessionManagerInterface } from "./baileys";
import { BaileysProvider } from "./baileys";

/**
 * Channel configuration for provider factory
 */
export interface ChannelConfig {
  /** Provider type */
  providerType: string;
  /** Channel ID */
  id: string;
  /** Additional provider-specific config */
  config?: Record<string, unknown>;
}

/**
 * Provider dependencies (injected)
 */
export interface ProviderDependencies {
  /** Get Baileys session manager for a channel */
  getBaileysSession?: (channelId: string) => BaileysSessionManagerInterface;
}

/**
 * WhatsApp Provider Factory
 * Creates the appropriate provider instance based on channel configuration
 */
export class WhatsAppProviderFactory {
  constructor(private dependencies: ProviderDependencies) {}

  /**
   * Create a WhatsApp provider instance
   *
   * @param channel - Channel configuration
   * @returns WhatsApp provider instance
   * @throws Error if provider type is unknown or dependencies are missing
   */
  create(channel: ChannelConfig): WhatsAppProvider {
    switch (channel.providerType) {
      case PROVIDER_TYPES.BAILEYS: {
        if (!this.dependencies.getBaileysSession) {
          throw new Error(
            "getBaileysSession dependency is required for Baileys provider",
          );
        }

        const session = this.dependencies.getBaileysSession(channel.id);
        return new BaileysProvider(session);
      }

      default:
        throw new Error(`Unknown provider type: ${channel.providerType}`);
    }
  }
}
