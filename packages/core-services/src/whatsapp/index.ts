/**
 * WhatsApp Services
 *
 * Serviços dedicados para operações com WhatsApp via Evolution API.
 *
 * Segregação de responsabilidades por canal (SOLID):
 * - WhatsApp → whatsapp/
 * - Cross-Org → cross-org/
 * - Futuro: Telegram, Instagram, etc.
 */

export { WhatsAppMessageService } from "./whatsapp-message.service";
export type { WhatsAppMessageServiceConfig } from "./whatsapp-message.service";

export { WhatsAppSenderService } from "./whatsapp-sender.service";

export type {
  SendWhatsAppTextInput,
  SendWhatsAppMediaInput,
  SendMessageResult,
  MarkAsReadInput,
  WhatsAppSendTextParams,
  WhatsAppSendMediaParams,
  WhatsAppMarkAsReadParams,
} from "./whatsapp-message.types";

/**
 * Factory para criar instância do WhatsAppMessageService
 *
 * Facilita injeção de dependências e testes
 */
import type { WhatsAppMessageServiceConfig } from "./whatsapp-message.service";
import { WhatsAppMessageService } from "./whatsapp-message.service";

let whatsappServiceInstance: WhatsAppMessageService | null = null;

export function getWhatsAppMessageService(
  config: WhatsAppMessageServiceConfig,
): WhatsAppMessageService {
  if (!whatsappServiceInstance) {
    whatsappServiceInstance = new WhatsAppMessageService(config);
  }
  return whatsappServiceInstance;
}
