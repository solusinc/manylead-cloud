import type { TenantDB, Chat, Agent } from "@manylead/db";

/**
 * Chat Service Configuration
 *
 * Config pattern seguindo MessageService
 */
export interface ChatServiceConfig {
  redisUrl: string;
  getTenantConnection: (orgId: string) => Promise<TenantDB>;
  getCatalogDb: () => unknown;
}

/**
 * Chat Context
 *
 * Context passado para todos os métodos do ChatService
 */
export interface ChatContext {
  organizationId: string;
  tenantDb: TenantDB;
  agentId: string;
  userId: string;
}

/**
 * Agent Context
 *
 * Representa o agent atual com suas permissões
 */
export interface AgentContext {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  permissions: {
    departments: {
      type: "all" | "specific";
      ids?: string[];
    };
    channels: {
      type: "all" | "specific";
      ids?: string[];
    };
    messages: {
      canEdit: boolean;
      canDelete: boolean;
    };
    accessFinishedChats: boolean;
  };
}

/**
 * Input: Assign Chat
 */
export interface AssignChatInput {
  id: string;
  createdAt: Date;
  agentId: string;
  departmentId?: string;
}

/**
 * Input: Transfer Chat
 */
export interface TransferChatInput {
  id: string;
  createdAt: Date;
  toAgentId?: string;
  toDepartmentId?: string;
}

/**
 * Input: Close Chat
 */
export interface CloseChatInput {
  id: string;
  createdAt: Date;
  endingId?: string;
}

/**
 * Input: Update Chat
 */
export interface UpdateChatInput {
  id: string;
  createdAt: Date;
  data: Partial<Chat>;
}

/**
 * Input: Chat List Filters
 */
export interface ChatListFilters {
  status?: "open" | "pending" | "closed" | "snoozed";
  assignedTo?: string;
  agentIds?: string[];
  departmentId?: string;
  departmentIds?: string[];
  messageSource?: "whatsapp" | "internal";
  messageSources?: ("whatsapp" | "internal")[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  unreadOnly?: boolean;
  tagIds?: string[];
  endingIds?: string[];
  isArchived?: boolean;
  limit: number;
  offset: number;
}

/**
 * Re-export types from @manylead/db for convenience
 */
export type { Chat, Agent, TenantDB };
