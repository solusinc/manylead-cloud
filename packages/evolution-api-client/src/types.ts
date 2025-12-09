/**
 * Evolution API Types
 * Baseado em: https://doc.evolution-api.com/v2/en
 */

export type ConnectionState = "open" | "close" | "connecting";

export interface EvolutionInstance {
  instanceName: string;
  status: string;
  state?: ConnectionState;
  connectionStatus?: ConnectionState; // Real field from Evolution API
  qrcode?: {
    code: string;
    base64?: string;
  };
  owner?: string;
  profilePictureUrl?: string;
  profileName?: string;
  integration?: string;
}

export interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  number?: string;
  qrcode?: boolean;
  integration?: "WHATSAPP-BAILEYS" | "WHATSAPP-BUSINESS";
  webhook?: {
    url: string;
    enabled: boolean;
    webhookByEvents?: boolean;
    events?: string[];
  };
  webhookWaBusiness?: {
    url: string;
    enabled: boolean;
    webhookByEvents?: boolean;
    events?: string[];
  };
  chatwoot?: {
    enabled: boolean;
    accountId?: string;
    token?: string;
    url?: string;
    signMsg?: boolean;
    reopenConversation?: boolean;
    conversationPending?: boolean;
  };
  rabbitmq?: {
    enabled: boolean;
    events?: string[];
  };
  sqs?: {
    enabled: boolean;
    events?: string[];
  };
  websocket?: {
    enabled: boolean;
    events?: string[];
  };
  // Proxy fields (flat, not nested)
  proxyHost?: string;
  proxyPort?: string;
  proxyProtocol?: string;
  proxyUsername?: string;
  proxyPassword?: string;
  // Keep WhatsApp always online
  alwaysOnline?: boolean;
}

export interface CreateInstanceResponse {
  instance: EvolutionInstance;
  hash: {
    apikey: string;
  };
  webhook?: {
    webhook: {
      url: string;
      enabled: boolean;
      webhookByEvents: boolean;
      events: string[];
    };
  };
}

export type FetchInstanceResponse = EvolutionInstance[] | EvolutionInstance;

export interface ConnectInstanceResponse {
  code: string;
  base64: string;
  count?: number;
}

export interface LogoutInstanceResponse {
  status: string;
  error?: boolean;
  response?: {
    message: string;
  };
}

export interface DeleteInstanceResponse {
  status: string;
  error?: boolean;
  response?: {
    message: string;
  };
}

export interface SendTextMessageRequest {
  number: string;
  text: string;
  delay?: number;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
  };
}

export interface SendMediaMessageRequest {
  number: string;
  media: string; // URL or base64
  mediatype?: "image" | "video" | "audio" | "document";
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface SendAudioMessageRequest {
  number: string;
  audio: string; // URL or base64
  delay?: number;
  encoding?: boolean;
  ptt?: boolean; // Push-to-talk (voice message)
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
  };
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

export interface SetProxyRequest {
  enabled: boolean;
  host?: string;
  port?: string;
  protocol?: "http" | "https" | "socks4" | "socks5";
  username?: string;
  password?: string;
}

export interface SetProxyResponse {
  enabled: boolean;
  host?: string;
  port?: string;
  protocol?: string;
  username?: string;
  password?: string;
}

export interface WebhookEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
  destination?: string;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

export interface MediaDownloadResponse {
  base64: string;
  mimetype: string;
  filename?: string;
}

export interface EvolutionAPIError {
  error: string;
  message: string;
  statusCode?: number;
}

export interface MarkAsReadRequest {
  readMessages: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  }[];
}

export interface MarkAsReadResponse {
  message: string;
  read: string;
}

export interface UpdateMessageRequest {
  number: string;
  text: string;
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
}

export interface UpdateMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

export interface DeleteMessageRequest {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string; // Para mensagens de grupo
}

export interface DeleteMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    protocolMessage: {
      key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
      };
      type: "REVOKE";
    };
  };
  messageTimestamp: string;
  status: "PENDING";
}

/**
 * Presence states supported by WhatsApp
 */
export type PresenceState =
  | "composing" // Digitando
  | "recording" // Gravando áudio
  | "paused" // Pausado (limpar indicador)
  | "available" // Online
  | "unavailable"; // Offline

/**
 * Send presence request
 * https://doc.evolution-api.com/v2/api-reference/chat-controller/send-presence
 */
export interface SendPresenceRequest {
  number: string; // Phone number without @s.whatsapp.net
  delay: number; // Delay in milliseconds
  presence: PresenceState; // Presence state to send
}

/**
 * Send presence response
 */
export interface SendPresenceResponse {
  status: string; // "SUCCESS" ou error
  message?: string; // Success/error message
}

/**
 * Check WhatsApp numbers request
 * https://doc.evolution-api.com/v2/api-reference/chat-controller/check-is-whatsapp
 */
export interface CheckWhatsAppNumbersRequest {
  numbers: string[]; // Array of phone numbers to check
}

/**
 * WhatsApp number check result
 */
export interface WhatsAppNumberCheck {
  exists: boolean; // Whether WhatsApp account exists
  jid: string; // WhatsApp JID (e.g., "5511999999999@s.whatsapp.net")
  number: string; // Phone number
}

/**
 * Check WhatsApp numbers response
 */
export type CheckWhatsAppNumbersResponse = WhatsAppNumberCheck[];
