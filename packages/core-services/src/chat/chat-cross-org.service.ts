import { agent, user, eq, inArray } from "@manylead/db";
import type { TenantDB, Chat, Contact } from "@manylead/db";

/**
 * Chat Cross-Org Service
 *
 * Responsabilidades:
 * - Resolver "outro participante" em chats internos
 * - Substituir contact por dados do initiator (se necessário)
 * - Lidar com lógica cross-org e intra-org
 *
 * Lógica de resolução:
 * - Se chat NÃO é interno: retornar contact original
 * - Se currentAgent é INICIADOR: retornar contact (target)
 * - Se currentAgent é TARGET: buscar dados do INICIADOR e substituir contact
 */
export class ChatCrossOrgService {
  constructor(
    private tenantDb: TenantDB,
    private catalogDb: unknown, // CatalogDB type
  ) {}

  /**
   * Resolver participante de um chat interno (single)
   *
   * Usado em procedures individuais como getById
   */
  async resolveInternalChatParticipant(
    chat: Chat,
    originalContact: Contact | null,
    currentAgentId: string,
  ): Promise<Contact | null> {
    // Não é chat interno, retornar contact original
    if (chat.messageSource !== "internal") {
      return originalContact;
    }

    // Não tem contact original, retornar null
    if (!originalContact) {
      return null;
    }

    // Se currentAgent é o INICIADOR, contact é o TARGET (retornar original)
    if (chat.initiatorAgentId === currentAgentId) {
      return originalContact;
    }

    // Se não tem initiator, retornar original
    if (!chat.initiatorAgentId) {
      return originalContact;
    }

    // CurrentAgent é o TARGET, buscar dados do INICIADOR
    const [initiatorAgent] = await this.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, chat.initiatorAgentId))
      .limit(1);

    if (!initiatorAgent) {
      return originalContact;
    }

    // Buscar user do initiator no catalog
    const catalogDbTyped = this.catalogDb as TenantDB;
    const [initiatorUser] = await catalogDbTyped
      .select()
      .from(user)
      .where(eq(user.id, initiatorAgent.userId))
      .limit(1);

    if (!initiatorUser) {
      return originalContact;
    }

    // Substituir contact pelos dados do INICIADOR
    return {
      id: originalContact.id,
      organizationId: originalContact.organizationId,
      phoneNumber: null,
      isGroup: false,
      groupJid: null,
      name: initiatorUser.name,
      avatar: initiatorUser.image,
      email: originalContact.email,
      customName: originalContact.customName,
      notes: originalContact.notes,
      customFields: originalContact.customFields,
      createdAt: originalContact.createdAt,
      updatedAt: originalContact.updatedAt,
      metadata: originalContact.metadata,
    };
  }

  /**
   * Resolver múltiplos participantes em batch
   *
   * Otimização para procedure list que processa múltiplos chats
   * Usa Maps para O(1) lookup e minimiza queries ao banco
   */
  async resolveMultipleParticipants(
    chats: { chat: Chat; contact: Contact | null }[],
    currentAgentId: string,
  ): Promise<{ chat: Chat; contact: Contact | null }[]> {
    // Separar chats internos dos não-internos
    const internalChats = chats.filter((c) => c.chat.messageSource === "internal");

    // Se não tem chats internos, retornar tudo como está
    if (internalChats.length === 0) {
      return chats;
    }

    // Buscar todos os initiator agents em uma query (batch optimization)
    const initiatorAgentIds = internalChats
      .map((c) => c.chat.initiatorAgentId)
      .filter((id) => id !== null && id !== currentAgentId) as string[];

    // Se não tem initiators para resolver, retornar original
    if (initiatorAgentIds.length === 0) {
      return chats;
    }

    // Buscar agents em batch
    const initiatorAgents = await this.tenantDb
      .select()
      .from(agent)
      .where(inArray(agent.id, initiatorAgentIds));

    // Criar Map para O(1) lookup
    const agentMap = new Map(initiatorAgents.map((a) => [a.id, a]));

    // Buscar users do catalog em batch
    const userIds = initiatorAgents.map((a) => a.userId);
    const catalogDbTyped = this.catalogDb as TenantDB;
    const initiatorUsers = await catalogDbTyped
      .select()
      .from(user)
      .where(inArray(user.id, userIds));

    // Criar Map para O(1) lookup
    const userMap = new Map(initiatorUsers.map((u) => [u.id, u]));

    // Resolver cada chat
    return chats.map((item) => {
      // Não é interno, retornar original
      if (item.chat.messageSource !== "internal") {
        return item;
      }

      // CurrentAgent é iniciador, retornar original (contact é o target)
      if (item.chat.initiatorAgentId === currentAgentId) {
        return item;
      }

      // Não tem initiator ou contact, retornar original
      if (!item.chat.initiatorAgentId || !item.contact) {
        return item;
      }

      // Buscar dados do initiator
      const initiatorAgent = agentMap.get(item.chat.initiatorAgentId);
      if (!initiatorAgent) {
        return item;
      }

      const initiatorUser = userMap.get(initiatorAgent.userId);
      if (!initiatorUser) {
        return item;
      }

      // Substituir contact pelos dados do initiator
      return {
        ...item,
        contact: {
          id: item.contact.id,
          organizationId: item.contact.organizationId,
          phoneNumber: null,
          isGroup: false,
          groupJid: null,
          name: initiatorUser.name,
          avatar: initiatorUser.image,
          email: item.contact.email,
          customName: item.contact.customName,
          notes: item.contact.notes,
          customFields: item.contact.customFields,
          createdAt: item.contact.createdAt,
          updatedAt: item.contact.updatedAt,
          metadata: item.contact.metadata,
        },
      };
    });
  }
}
