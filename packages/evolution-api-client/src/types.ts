/**
 * Evolution API Types
 * Baseado em: https://doc.evolution-api.com/v2/en
 */

export type ConnectionState = "open" | "close" | "connecting";

export interface EvolutionInstance {
  instanceName: string;
  status: string;
  state?: ConnectionState;
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
  proxy?: {
    enabled: boolean;
    host?: string;
    port?: string;
    protocol?: string;
    username?: string;
    password?: string;
  };
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
