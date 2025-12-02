import type { TenantDB, Chat, Message } from "@manylead/db";

export interface MessageServiceConfig {
  redisUrl: string;
  getTenantConnection: (orgId: string) => Promise<TenantDB>;
  getCatalogDb: () => unknown;
}

export interface CreateMessageInput {
  chatId: string;
  content: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
  agentId: string;
  agentName: string;
  repliedToMessageId?: string;
  tempId?: string;
  attachmentData?: {
    fileName: string;
    mimeType: string;
    mediaType: string;
    storagePath: string;
    storageUrl: string;
    fileSize?: number | null;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
  };
}

export interface UpdateMessageInput {
  content: string;
}

export interface MessageContext {
  organizationId: string;
  tenantDb: TenantDB;
  agentId: string;
  agentName: string;
}

export interface CreateMessageResult {
  message: Message;
  chat: Chat;
}
