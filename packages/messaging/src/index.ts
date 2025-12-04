// Internal messaging
export { InternalMessageService, getInternalMessageService } from "./internal";

// WhatsApp messaging
export { WhatsAppMessageService, getWhatsAppMessageService } from "./whatsapp";
export type { WhatsAppMessageServiceConfig } from "./whatsapp";

// Types
export type {
  MessageServiceConfig,
  CreateMessageInput,
  UpdateMessageInput,
  MessageContext,
  CreateMessageResult,
} from "./types";

export type {
  SendWhatsAppTextInput,
  SendMessageResult,
  MarkAsReadInput,
} from "./whatsapp";
