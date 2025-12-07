/**
 * Evolution API Webhook Types
 *
 * Documentação: https://doc.evolution-api.com/v2/en/webhooks
 */

export interface EvolutionWebhookPayload {
  event: EvolutionWebhookEvent;
  instance: string;
  data: unknown;
  destination?: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

export type EvolutionWebhookEvent =
  | "qrcode.updated"
  | "connection.update"
  | "messages.upsert"
  | "messages.update"
  | "messages.delete"
  | "send.message"
  | "contacts.upsert"
  | "contacts.update"
  | "presence.update"
  | "chats.upsert"
  | "chats.update"
  | "chats.delete"
  | "groups.upsert"
  | "groups.update"
  | "group-participants.update"
  | "labels.edit"
  | "labels.association";

export interface QRCodeData {
  qrcode: {
    code: string;
    base64: string;
  };
}

export interface ConnectionUpdateData {
  state: "open" | "close" | "connecting";
  statusReason?: string | number;
  instance: string;
  wuid?: string;
  profileName?: string;
  profilePictureUrl?: string | null;
}

export interface MessageData {
  key: {
    remoteJid: string;
    remoteJidAlt?: string; // Novo formato LID do WhatsApp
    fromMe: boolean;
    id: string;
    participant?: string;
    addressingMode?: string;
  };
  pushName?: string;
  message?: Record<string, unknown>;
  messageType?: string;
  messageTimestamp: string | number;
  instanceId?: string;
  source?: string;
  status?: string;
  contextInfo?: Record<string, unknown>;
}

// Evolution API envia mensagem única, não array
export type MessagesUpsertData = MessageData;

/**
 * Tipo de dados para messages.update (Evolution API v2.3.6)
 * Formato real da Evolution API - single object, não array
 */
export interface MessagesUpdateData {
  keyId: string;
  remoteJid: string;
  fromMe: boolean;
  status: string; // "SERVER_ACK" | "DELIVERY_ACK" | "READ"
  instanceId: string;
  messageId: string;
}

export interface MessagesDeleteData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
}

export interface SendMessageData {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

/**
 * Handler context - dados compartilhados entre handlers
 */
export interface HandlerContext {
  organizationId: string;
  channelId: string;
  instanceName: string;
}

/**
 * Presence update webhook data
 */
export interface PresenceUpdateData {
  remoteJid: string; // Contact JID (e.g., "5521984848843@s.whatsapp.net")
  presences: string[]; // Array of presence states (e.g., ["composing"])
  participant?: string; // For group chats
}
