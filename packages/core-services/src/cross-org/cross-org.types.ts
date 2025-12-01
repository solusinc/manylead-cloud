import type { TenantDB, Chat, Contact, Message } from "@manylead/db";

export interface CrossOrgContext {
  sourceOrgId: string;
  sourceTenantDb: TenantDB;
  sourceChat: Chat;
  sourceContact: Contact;
}

export interface MirrorMessageInput {
  content: string;
  messageType: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface MirrorResult {
  targetOrgId: string;
  mirroredChatId: string;
  mirroredMessageId?: string;
}

export interface CrossOrgMirrorConfig {
  redisUrl: string;
  getTenantConnection: (orgId: string) => Promise<TenantDB>;
  getCatalogDb: () => unknown;
}

// Re-export types for convenience
export type { Chat, Contact, Message };
