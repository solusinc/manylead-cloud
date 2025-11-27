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
