/**
 * WhatsApp Message Types
 *
 * Types específicos para operações com WhatsApp
 */

export interface SendWhatsAppTextInput {
  chatId: string;
  chatCreatedAt: Date;
  agentId: string;
  agentName: string;
  content: string;
  repliedToMessageId?: string;
  metadata?: Record<string, unknown>;
  // 🆕 Suporte opcional a attachment (mídia)
  attachmentData?: {
    mediaType: "image" | "video" | "audio" | "document";
    mimeType: string;
    fileName: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    storagePath: string;
    storageUrl: string;
  };
}

export interface SendMessageResult {
  messageId: string;
  messageCreatedAt: Date;
  whatsappMessageId: string | null;
  status: "sent" | "failed";
  error?: {
    code: string;
    message: string;
  };
}

export interface MarkAsReadInput {
  chatId: string;
  chatCreatedAt: Date;
  messageIds: string[];
}

export interface WhatsAppSendTextParams {
  instanceName: string;
  phoneNumber: string;
  text: string;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
  };
}

export interface WhatsAppSendMediaParams {
  instanceName: string;
  phoneNumber: string;
  mediaType: "image" | "audio" | "video" | "document";
  mediaUrl: string;
  filename?: string;
  caption?: string;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
  };
}

export interface WhatsAppMarkAsReadParams {
  instanceName: string;
  remoteJid: string;
  fromMe: boolean;
  messageId: string;
}
