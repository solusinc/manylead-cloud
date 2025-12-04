// WhatsApp messaging
export { WhatsAppMessageService, getWhatsAppMessageService } from "./whatsapp-message.service";
export type { WhatsAppMessageServiceConfig } from "./whatsapp-message.service";

// WhatsApp sender (para uso em workers)
export { WhatsAppSenderService } from "./whatsapp-sender.service";

// Audio converter (para uso em workers)
export { AudioConverterService } from "./audio-converter.service";

// Types
export type {
  SendWhatsAppTextInput,
  SendMessageResult,
  MarkAsReadInput,
  WhatsAppSendTextParams,
  WhatsAppSendMediaParams,
  WhatsAppMarkAsReadParams,
} from "./whatsapp-message.types";
