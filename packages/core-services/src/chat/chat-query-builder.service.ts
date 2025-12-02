import {
  chat,
  contact,
  agent,
  chatParticipant,
  chatTag,
  tag,
  user,
  message,
  eq,
  and,
  or,
  gte,
  lte,
  ilike,
  inArray,
  isNull,
  ne,
  desc,
  asc,
  count,
  sql

} from "@manylead/db";
import type {SQL} from "@manylead/db";
import type { TenantDB, Chat, Contact, Agent, ChatParticipant } from "@manylead/db";

import type { AgentContext, ChatListFilters, ChatServiceConfig } from "./chat.types";

export interface ChatListItem {
  chat: Chat;
  contact: Contact | null;
  assignedAgent: Agent | null;
  participant: ChatParticipant | null;
  tags: { id: string; name: string; color: string }[];
  assignedAgentName: string | null;
  lastMessageIsDeleted: boolean;
  lastMessageType: string | null;
}

export interface ChatListResult {
  items: ChatListItem[];
  total: number;
}

/**
 * Chat Query Builder Service
 *
 * Responsabilidades:
 * - Construir query de listagem com filtros complexos
 * - Aplicar permissões baseadas em role
 * - Batch optimization para tags e agent names
 * - Paginação
 *
 * Fase 5: Implementação completa com 15+ tipos de filtros
 */
export class ChatQueryBuilderService {
  private getTenantConnection: (orgId: string) => Promise<TenantDB>;
  private getCatalogDb: () => unknown;

  constructor(config: ChatServiceConfig) {
    this.getTenantConnection = config.getTenantConnection;
    this.getCatalogDb = config.getCatalogDb;
  }

  /**
   * Listar chats com filtros e paginação
   *
   * Aplica todos os filtros, permissões, e retorna com batch optimization
   */
  async list(
    tenantDb: TenantDB,
    currentAgent: AgentContext | null,
    filters: ChatListFilters,
  ): Promise<ChatListResult> {
    // 1. Construir where conditions
    const conditions = this.buildWhereConditions(currentAgent, filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 2. Executar queries em paralelo (main + count)
    const [items, totalResult] = await Promise.all([
      this.executeMainQuery(tenantDb, currentAgent, where, filters),
      this.executeCountQuery(tenantDb, currentAgent, where, filters),
    ]);

    // 3. Batch optimization: buscar tags
    const itemsWithTags = await this.fetchAndAttachTags(tenantDb, items);

    // 4. Batch optimization: buscar agent names
    const itemsWithAgentNames = await this.fetchAndAttachAgentNames(
      itemsWithTags,
    );

    // 5. Mapear unreadCount correto (pending vs assigned)
    const finalItems = this.mapUnreadCount(itemsWithAgentNames);

    return {
      items: finalItems,
      total: totalResult[0]?.count ?? 0,
    };
  }

  /**
   * Construir where conditions baseado em filtros e permissões
   *
   * 15+ tipos de filtros implementados
   */
  private buildWhereConditions(
    currentAgent: AgentContext | null,
    filters: ChatListFilters,
  ): SQL<unknown>[] {
    const conditions: SQL<unknown>[] = [];

    // 1. Permissões baseadas em role
    if (currentAgent) {
      if (currentAgent.role === "member") {
        // Members só veem chats pending OU atribuídos a eles
        const roleCondition = or(
          eq(chat.status, "pending"),
          eq(chat.assignedTo, currentAgent.id),
        );
        if (roleCondition) {
          conditions.push(roleCondition);
        }
      }
      // owner e admin veem tudo
    }

    // 2. Filtro de departamento baseado em permissões
    if (currentAgent?.permissions.departments) {
      const deptPermissions = currentAgent.permissions.departments;

      if (
        deptPermissions.type === "specific" &&
        deptPermissions.ids &&
        deptPermissions.ids.length > 0
      ) {
        const deptCondition = or(
          inArray(chat.departmentId, deptPermissions.ids),
          eq(chat.assignedTo, currentAgent.id),
          isNull(chat.departmentId),
        );
        if (deptCondition) {
          conditions.push(deptCondition);
        }
      }
    }

    // 3. Filtro de chats finalizados (accessFinishedChats permission)
    if (currentAgent) {
      if (
        currentAgent.role === "member" &&
        !currentAgent.permissions.accessFinishedChats
      ) {
        conditions.push(ne(chat.status, "closed"));
      }
    }

    // 4. Filtro de status
    if (filters.status) {
      conditions.push(eq(chat.status, filters.status));
    }

    // 5. Filtro de assignedTo
    if (filters.assignedTo) {
      conditions.push(eq(chat.assignedTo, filters.assignedTo));
    }

    // 6. Filtro de agentIds (OR - qualquer um dos selecionados)
    if (filters.agentIds && filters.agentIds.length > 0) {
      conditions.push(inArray(chat.assignedTo, filters.agentIds));
    }

    // 7. Filtro de departmentId
    if (filters.departmentId) {
      conditions.push(eq(chat.departmentId, filters.departmentId));
    }

    // 8. Filtro de departmentIds (OR - qualquer um dos selecionados)
    if (filters.departmentIds && filters.departmentIds.length > 0) {
      conditions.push(inArray(chat.departmentId, filters.departmentIds));
    }

    // 9. Filtro de messageSource
    if (filters.messageSource) {
      conditions.push(eq(chat.messageSource, filters.messageSource));
    }

    // 10. Filtro de messageSources (OR - qualquer um dos selecionados)
    if (filters.messageSources && filters.messageSources.length > 0) {
      conditions.push(inArray(chat.messageSource, filters.messageSources));
    }

    // 11. Filtro por período (data de criação)
    if (filters.dateFrom) {
      conditions.push(gte(chat.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(chat.createdAt, filters.dateTo));
    }

    // 12. Filtro de search (nome do contato ou telefone)
    if (filters.search) {
      const searchCondition = or(
        ilike(contact.name, `%${filters.search}%`),
        ilike(contact.phoneNumber, `%${filters.search}%`),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // 13. Filtro de unreadOnly
    if (filters.unreadOnly && currentAgent) {
      conditions.push(sql`${chatParticipant.unreadCount} > 0`);
      conditions.push(ne(chat.status, "pending"));
    }

    // 14. Filtro de tags (chats que têm TODAS as tags selecionadas)
    if (filters.tagIds && filters.tagIds.length > 0) {
      const chatsWithAllTags = sql`
        ${chat.id} IN (
          SELECT ct.chat_id
          FROM chat_tag ct
          WHERE ct.tag_id IN (${sql.join(filters.tagIds.map((id) => sql`${id}`), sql`, `)})
          GROUP BY ct.chat_id, ct.chat_created_at
          HAVING COUNT(DISTINCT ct.tag_id) = ${filters.tagIds.length}
        )
      `;
      conditions.push(chatsWithAllTags);
    }

    // 15. Filtro de endingIds (OR - qualquer um dos selecionados)
    if (filters.endingIds && filters.endingIds.length > 0) {
      conditions.push(inArray(chat.endingId, filters.endingIds));
    }

    // 16. Filtro de isArchived
    if (filters.isArchived !== undefined) {
      conditions.push(eq(chat.isArchived, filters.isArchived));
    }

    return conditions;
  }

  /**
   * Executar query principal com joins
   */
  private async executeMainQuery(
    tenantDb: TenantDB,
    currentAgent: AgentContext | null,
    where: SQL<unknown> | undefined,
    filters: ChatListFilters,
  ): Promise<
    {
      chat: Chat;
      contact: Contact | null;
      assignedAgent: Agent | null;
      participant: ChatParticipant | null;
      lastMessageIsDeleted: boolean;
      lastMessageType: string | null;
    }[]
  > {
    let query = tenantDb
      .select({
        chat,
        contact,
        assignedAgent: agent,
        participant: chatParticipant,
        lastMessageIsDeleted: message.isDeleted,
        lastMessageType: message.messageType,
      })
      .from(chat)
      .leftJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(agent, eq(chat.assignedTo, agent.id))
      .leftJoin(
        chatParticipant,
        currentAgent
          ? and(
              eq(chatParticipant.chatId, chat.id),
              eq(chatParticipant.chatCreatedAt, chat.createdAt),
              eq(chatParticipant.agentId, currentAgent.id),
            )
          : undefined,
      )
      .leftJoin(
        message,
        and(
          eq(message.chatId, chat.id),
          eq(message.timestamp, chat.lastMessageAt),
        ),
      );

    if (where) {
      query = query.where(where) as typeof query;
    }

    const result = await query
      .limit(filters.limit)
      .offset(filters.offset)
      .orderBy(
        // When not viewing archived: show pinned first, ordered by when they were pinned
        ...(filters.isArchived !== true ? [desc(chat.isPinned), asc(chat.pinnedAt)] : []),
        // Then by last message time
        desc(chat.lastMessageAt)
      );

    // Cast role para o tipo correto
    return result.map((item) => ({
      ...item,
      lastMessageIsDeleted: item.lastMessageIsDeleted ?? false,
      lastMessageType: item.lastMessageType ?? "text",
      assignedAgent: item.assignedAgent
        ? {
            ...item.assignedAgent,
            role: item.assignedAgent.role as "owner" | "admin" | "member",
          }
        : null,
    }));
  }

  /**
   * Executar query de count
   */
  private async executeCountQuery(
    tenantDb: TenantDB,
    currentAgent: AgentContext | null,
    where: SQL<unknown> | undefined,
    filters: ChatListFilters,
  ): Promise<{ count: number }[]> {
    // Se tem search ou unreadOnly, precisa fazer JOIN
    if (filters.search || filters.unreadOnly) {
      let query = tenantDb
        .select({ count: count() })
        .from(chat)
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .leftJoin(
          chatParticipant,
          currentAgent
            ? and(
                eq(chatParticipant.chatId, chat.id),
                eq(chatParticipant.chatCreatedAt, chat.createdAt),
                eq(chatParticipant.agentId, currentAgent.id),
              )
            : undefined,
        );

      if (where) {
        query = query.where(where) as typeof query;
      }

      return query;
    }

    // Query simples de count
    let simpleQuery = tenantDb.select({ count: count() }).from(chat);

    if (where) {
      simpleQuery = simpleQuery.where(where) as typeof simpleQuery;
    }

    return simpleQuery;
  }

  /**
   * Batch optimization: buscar tags para todos os chats
   */
  private async fetchAndAttachTags(
    tenantDb: TenantDB,
    items: {
      chat: Chat;
      contact: Contact | null;
      assignedAgent: Agent | null;
      participant: ChatParticipant | null;
      lastMessageIsDeleted: boolean;
      lastMessageType: string | null;
    }[],
  ): Promise<
    {
      chat: Chat;
      contact: Contact | null;
      assignedAgent: Agent | null;
      participant: ChatParticipant | null;
      lastMessageIsDeleted: boolean;
      lastMessageType: string | null;
      tags: { id: string; name: string; color: string }[];
    }[]
  > {
    const chatIds = items.map((i) => i.chat.id);

    // Buscar todas as tags em uma query
    const chatTagsData =
      chatIds.length > 0
        ? await tenantDb
            .select({
              chatId: chatTag.chatId,
              chatCreatedAt: chatTag.chatCreatedAt,
              tagId: tag.id,
              tagName: tag.name,
              tagColor: tag.color,
            })
            .from(chatTag)
            .innerJoin(tag, eq(chatTag.tagId, tag.id))
            .where(inArray(chatTag.chatId, chatIds))
        : [];

    // Criar Map de tags por chatId para lookup O(1)
    const tagsByChat = new Map<
      string,
      { id: string; name: string; color: string }[]
    >();

    for (const ct of chatTagsData) {
      const key = ct.chatId;
      const existing = tagsByChat.get(key);
      if (existing) {
        existing.push({
          id: ct.tagId,
          name: ct.tagName,
          color: ct.tagColor,
        });
      } else {
        tagsByChat.set(key, [
          {
            id: ct.tagId,
            name: ct.tagName,
            color: ct.tagColor,
          },
        ]);
      }
    }

    // Anexar tags aos items
    return items.map((item) => ({
      ...item,
      tags: tagsByChat.get(item.chat.id) ?? [],
    }));
  }

  /**
   * Batch optimization: buscar nomes dos agents atribuídos
   */
  private async fetchAndAttachAgentNames(
    items: {
      chat: Chat;
      contact: Contact | null;
      assignedAgent: Agent | null;
      participant: ChatParticipant | null;
      lastMessageIsDeleted: boolean;
      lastMessageType: string | null;
      tags: { id: string; name: string; color: string }[];
    }[],
  ): Promise<ChatListItem[]> {
    // Coletar userIds únicos dos agents atribuídos
    const assignedUserIds = [
      ...new Set(
        items
          .map((i) => i.assignedAgent?.userId)
          .filter((id): id is string => !!id),
      ),
    ];

    // Buscar users do catalog
    const catalogDb = this.getCatalogDb() as TenantDB;
    const assignedUsers =
      assignedUserIds.length > 0
        ? await catalogDb
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, assignedUserIds))
        : [];

    // Map de userId -> nome para lookup O(1)
    const assignedUserNameMap = new Map(
      assignedUsers.map((u) => [u.id, u.name]),
    );

    // Anexar agent names aos items
    return items.map((item) => ({
      ...item,
      assignedAgentName: item.assignedAgent?.userId
        ? assignedUserNameMap.get(item.assignedAgent.userId) ?? null
        : null,
    }));
  }

  /**
   * Mapear unreadCount correto
   *
   * - Pending chats: usa chat.unreadCount (badge global para todos verem)
   * - Assigned chats: usa participant.unreadCount (badge individual por agent)
   */
  private mapUnreadCount(items: ChatListItem[]): ChatListItem[] {
    return items.map((item) => {
      // Pending chats: badge global (todos veem o mesmo)
      // Assigned chats: badge individual (cada um vê o seu)
      const finalUnreadCount =
        item.chat.status === "pending"
          ? item.chat.unreadCount // Pending: badge global (todos veem)
          : item.participant?.unreadCount ?? 0; // Assigned: badge individual

      return {
        ...item,
        chat: {
          ...item.chat,
          unreadCount: finalUnreadCount,
        },
      };
    });
  }
}

// Singleton instance
let chatQueryBuilderServiceInstance: ChatQueryBuilderService | null = null;

/**
 * Get or create ChatQueryBuilderService singleton
 */
export function getChatQueryBuilderService(
  config: ChatServiceConfig,
): ChatQueryBuilderService {
  chatQueryBuilderServiceInstance ??= new ChatQueryBuilderService(config);
  return chatQueryBuilderServiceInstance;
}
