import {
  agent,
  and,
  attachment,
  chat,
  chatParticipant,
  contact,
  eq,
  message,
  or,
  organization,
  sql,
} from "@manylead/db";

import type { TenantDB, CatalogDB, Chat, Contact } from "@manylead/db";
import type { EventPublisher } from "../events";
import type { CrossOrgMirrorConfig } from "./cross-org.types";
import { getEventPublisher } from "../events";

/**
 * CrossOrgMirrorService
 *
 * Responsável por espelhar mensagens, status e operações entre organizações
 * em chats internos (messageSource = "internal").
 */
export class CrossOrgMirrorService {
  private redisUrl: string;
  private getTenantConnection: (orgId: string) => Promise<TenantDB>;
  private getCatalogDb: () => CatalogDB;
  private eventPublisher: EventPublisher;

  constructor(config: CrossOrgMirrorConfig) {
    this.redisUrl = config.redisUrl;
    this.getTenantConnection = config.getTenantConnection;
    this.getCatalogDb = config.getCatalogDb as () => CatalogDB;
    this.eventPublisher = getEventPublisher(config.redisUrl);
  }

  /**
   * Verifica se um chat deve ter mensagens espelhadas
   */
  shouldMirror(chatRecord: Chat): boolean {
    return chatRecord.messageSource === "internal";
  }

  /**
   * Obtém o ID da organização destino a partir do contact
   */
  async getTargetOrgId(
    tenantDb: TenantDB,
    chatRecord: Chat,
  ): Promise<string | null> {
    const [contactRecord] = await tenantDb
      .select()
      .from(contact)
      .where(eq(contact.id, chatRecord.contactId))
      .limit(1);

    const metadata = contactRecord?.metadata as Record<string, unknown> | undefined;
    return (metadata?.targetOrganizationId as string | undefined) ?? null;
  }

  /**
   * Espelha a primeira mensagem de texto em um novo chat cross-org
   * Cria o contact e chat na org destino
   */
  async mirrorFirstMessage(
    sourceOrgId: string,
    sourceTenantDb: TenantDB,
    sourceChat: Chat,
    messageId: string,
    messageTimestamp: Date,
    messageContent: string,
    metadata?: Record<string, unknown>,
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
    },
  ): Promise<void> {
    // Buscar contact source para pegar targetOrganizationId
    const [contactRecord] = await sourceTenantDb
      .select()
      .from(contact)
      .where(eq(contact.id, sourceChat.contactId))
      .limit(1);

    const contactMetadata = contactRecord?.metadata as Record<string, unknown> | undefined;
    const targetOrgId = contactMetadata?.targetOrganizationId as string | undefined;

    if (!targetOrgId) return;

    // Buscar dados da org source para criar contact na target
    const catalogDb = this.getCatalogDb();
    const [sourceOrg] = await catalogDb
      .select()
      .from(organization)
      .where(eq(organization.id, sourceOrgId))
      .limit(1);

    if (!sourceOrg) return;

    const targetTenantDb = await this.getTenantConnection(targetOrgId);
    const now = new Date();

    // Buscar ou criar contact representando a org source na org target
    const sourceContact = await this.findOrCreateSourceContact(
      targetTenantDb,
      targetOrgId,
      sourceOrgId,
      sourceOrg,
      now,
    );

    if (!sourceContact) return;

    // Buscar ou criar chat espelhado ativo
    // NUNCA pode ter dois chats abertos entre as mesmas orgs
    let mirroredChat = await this.findActiveMirroredChat(
      targetTenantDb,
      sourceContact.id,
    );

    // Se não encontrar chat ativo, criar novo
    if (!mirroredChat) {
      const [newChat] = await targetTenantDb
        .insert(chat)
        .values({
          organizationId: targetOrgId,
          contactId: sourceContact.id,
          channelId: null,
          messageSource: "internal",
          initiatorAgentId: null,
          assignedTo: null,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          lastMessageAt: now,
          lastMessageContent: messageContent.replace(/^\*\*.*?\*\*\n/, ""), // Remove signature
          lastMessageSender: "agent",
          lastMessageStatus: "sent",
          totalMessages: 0,
          unreadCount: 0,
        })
        .returning();

      if (!newChat) return;

      mirroredChat = newChat;

      // Emitir evento chat:created apenas para chats novos
      await this.eventPublisher.chatCreated(targetOrgId, newChat, {
        contact: sourceContact,
      });
    }

    // Criar mensagem espelhada com referência ao ID original
    const [mirroredMessage] = await targetTenantDb
      .insert(message)
      .values({
        chatId: mirroredChat.id,
        messageSource: "internal",
        sender: "agent",
        senderId: null,
        messageType: attachmentData?.mediaType === "image"
          ? "image"
          : attachmentData?.mediaType === "video"
          ? "video"
          : attachmentData?.mediaType === "document"
          ? "document"
          : attachmentData?.mediaType === "audio"
          ? "audio"
          : "text",
        content: messageContent,
        metadata: {
          ...metadata,
          originalMessageId: messageId,
        },
        status: "delivered",
        timestamp: messageTimestamp,
        sentAt: messageTimestamp,
        deliveredAt: messageTimestamp,
      })
      .returning();

    // Criar attachment espelhado (mesma URL)
    if (attachmentData && mirroredMessage) {
      await targetTenantDb.insert(attachment).values({
        messageId: mirroredMessage.id,
        fileName: attachmentData.fileName,
        mimeType: attachmentData.mimeType,
        mediaType: attachmentData.mediaType,
        storagePath: attachmentData.storagePath,
        storageUrl: attachmentData.storageUrl, // MESMA URL
        fileSize: attachmentData.fileSize ?? null,
        width: attachmentData.width ?? null,
        height: attachmentData.height ?? null,
        duration: attachmentData.duration ?? null,
        downloadStatus: "completed",
        downloadedAt: messageTimestamp,
      });
    }

    // Atualizar chat com nova mensagem
    await this.updateMirroredChatAfterMessage(
      targetTenantDb,
      mirroredChat,
      messageContent,
      messageTimestamp,
    );

    // Emitir evento message:created
    if (mirroredMessage) {
      await this.eventPublisher.messageCreated(
        targetOrgId,
        mirroredChat.id,
        mirroredMessage,
      );
    }
  }

  /**
   * Espelha uma mensagem subsequente em um chat cross-org existente
   */
  async mirrorSubsequentMessage(
    sourceOrgId: string,
    sourceTenantDb: TenantDB,
    sourceChat: Chat,
    messageId: string,
    messageTimestamp: Date,
    messageContent: string,
    metadata?: Record<string, unknown>,
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
    },
  ): Promise<void> {
    // Buscar contact source para pegar targetOrganizationId
    const [contactRecord] = await sourceTenantDb
      .select()
      .from(contact)
      .where(eq(contact.id, sourceChat.contactId))
      .limit(1);

    const contactMetadata = contactRecord?.metadata as Record<string, unknown> | undefined;
    const targetOrgId = contactMetadata?.targetOrganizationId as string | undefined;

    if (!targetOrgId) return;

    const targetTenantDb = await this.getTenantConnection(targetOrgId);

    // Buscar contact na org target que representa a org source
    const sourceContact = await this.findSourceContact(
      targetTenantDb,
      targetOrgId,
      sourceOrgId,
    );

    if (!sourceContact) return;

    // Buscar ou criar chat espelhado ativo
    let mirroredChat = await this.findActiveMirroredChat(
      targetTenantDb,
      sourceContact.id,
    );

    const now = new Date();

    // Se não encontrar chat ativo, criar nova sessão
    if (!mirroredChat) {
      const [newChat] = await targetTenantDb
        .insert(chat)
        .values({
          organizationId: targetOrgId,
          contactId: sourceContact.id,
          messageSource: "internal",
          status: "pending",
          assignedTo: null,
          unreadCount: 0,
          totalMessages: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!newChat) return;

      mirroredChat = newChat;

      // Emitir evento chat:created
      await this.eventPublisher.chatCreated(targetOrgId, newChat, {
        contact: sourceContact,
      });
    }

    // Criar mensagem espelhada com referência ao ID original
    const [mirroredMessage] = await targetTenantDb
      .insert(message)
      .values({
        chatId: mirroredChat.id,
        messageSource: "internal",
        sender: "agent",
        senderId: null,
        messageType: attachmentData?.mediaType === "image"
          ? "image"
          : attachmentData?.mediaType === "video"
          ? "video"
          : attachmentData?.mediaType === "document"
          ? "document"
          : attachmentData?.mediaType === "audio"
          ? "audio"
          : "text",
        content: messageContent,
        metadata: {
          ...metadata,
          originalMessageId: messageId,
        },
        status: "delivered",
        timestamp: messageTimestamp,
        sentAt: messageTimestamp,
        deliveredAt: messageTimestamp,
      })
      .returning();

    // Criar attachment espelhado (mesma URL)
    if (attachmentData && mirroredMessage) {
      await targetTenantDb.insert(attachment).values({
        messageId: mirroredMessage.id,
        fileName: attachmentData.fileName,
        mimeType: attachmentData.mimeType,
        mediaType: attachmentData.mediaType,
        storagePath: attachmentData.storagePath,
        storageUrl: attachmentData.storageUrl, // MESMA URL
        fileSize: attachmentData.fileSize ?? null,
        width: attachmentData.width ?? null,
        height: attachmentData.height ?? null,
        duration: attachmentData.duration ?? null,
        downloadStatus: "completed",
        downloadedAt: messageTimestamp,
      });
    }

    // Atualizar chat espelhado
    await this.updateMirroredChatAfterMessage(
      targetTenantDb,
      mirroredChat,
      messageContent.replace(/^\*\*.*?\*\*\n/, ""),
      messageTimestamp,
    );

    // Emitir evento message:new
    if (mirroredMessage) {
      await this.eventPublisher.messageCreated(
        targetOrgId,
        mirroredChat.id,
        mirroredMessage,
      );
    }
  }

  /**
   * Espelha status de leitura para a org source
   * Chamado quando destinatário lê mensagens
   */
  async mirrorReadStatus(
    currentOrgId: string,
    currentTenantDb: TenantDB,
    chatRecord: Chat,
  ): Promise<void> {
    // Buscar contact para pegar targetOrganizationId
    const [contactRecord] = await currentTenantDb
      .select()
      .from(contact)
      .where(eq(contact.id, chatRecord.contactId))
      .limit(1);

    const metadata = contactRecord?.metadata as Record<string, unknown> | undefined;
    const targetOrgId = metadata?.targetOrganizationId as string | undefined;

    if (!targetOrgId) return;

    const targetTenantDb = await this.getTenantConnection(targetOrgId);
    const now = new Date();

    // Buscar contact na org source que representa a nossa org
    const [targetContact] = await targetTenantDb
      .select()
      .from(contact)
      .where(
        sql`${contact.metadata} @> jsonb_build_object('targetOrganizationId', ${currentOrgId}::text)`,
      )
      .limit(1);

    if (!targetContact) return;

    // Buscar chat espelhado na org source (apenas ativos)
    const [targetChat] = await targetTenantDb
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.contactId, targetContact.id),
          eq(chat.messageSource, "internal"),
          or(eq(chat.status, "open"), eq(chat.status, "pending")),
        ),
      )
      .limit(1);

    if (!targetChat) return;

    // Atualizar status para 'read' nas mensagens enviadas (senderId IS NOT NULL)
    const updatedMessages = await targetTenantDb
      .update(message)
      .set({
        status: "read",
        readAt: now,
      })
      .where(
        and(
          eq(message.chatId, targetChat.id),
          sql`${message.senderId} IS NOT NULL`,
          sql`${message.status} != 'read'`,
        ),
      )
      .returning();

    // Verificar se alguma mensagem atualizada é a última do chat
    if (updatedMessages.length > 0 && targetChat.lastMessageAt) {
      const lastMessageTimestamp = targetChat.lastMessageAt.getTime();
      const hasLastMessage = updatedMessages.some(
        (msg) => msg.timestamp.getTime() === lastMessageTimestamp,
      );

      if (hasLastMessage) {
        // Atualizar lastMessageStatus no chat
        await targetTenantDb
          .update(chat)
          .set({
            lastMessageStatus: "read",
          })
          .where(eq(chat.id, targetChat.id));
      }
    }

    // Emitir eventos message:updated para cada mensagem
    for (const msg of updatedMessages) {
      await this.eventPublisher.messageUpdated(targetOrgId, targetChat.id, msg);
    }
  }

  /**
   * Espelha edição de mensagem
   */
  async mirrorEdit(
    sourceOrgId: string,
    sourceTenantDb: TenantDB,
    sourceChat: Chat,
    originalMessageId: string,
    newContent: string,
  ): Promise<void> {
    const targetOrgId = await this.getTargetOrgId(sourceTenantDb, sourceChat);
    if (!targetOrgId) return;

    const targetTenantDb = await this.getTenantConnection(targetOrgId);

    // Buscar contact na org target
    const sourceContact = await this.findSourceContact(
      targetTenantDb,
      targetOrgId,
      sourceOrgId,
    );

    if (!sourceContact) return;

    // Buscar chat espelhado ativo
    const mirroredChat = await this.findActiveMirroredChat(
      targetTenantDb,
      sourceContact.id,
    );

    if (!mirroredChat) return;

    // Buscar mensagem espelhada pelo originalMessageId
    const [mirroredMessage] = await targetTenantDb
      .select()
      .from(message)
      .where(
        and(
          eq(message.chatId, mirroredChat.id),
          sql`${message.metadata}->>'originalMessageId' = ${originalMessageId}`,
        ),
      )
      .limit(1);

    if (!mirroredMessage) return;

    const now = new Date();

    // Atualizar mensagem espelhada
    const [updatedMirrored] = await targetTenantDb
      .update(message)
      .set({
        content: newContent,
        isEdited: true,
        editedAt: now,
      })
      .where(eq(message.id, mirroredMessage.id))
      .returning();

    // Emitir evento na org target
    if (updatedMirrored) {
      await this.eventPublisher.messageUpdated(
        targetOrgId,
        mirroredChat.id,
        updatedMirrored,
      );

      // Se a mensagem editada é a última mensagem do chat, atualizar também o chat
      if (
        mirroredChat.lastMessageAt &&
        updatedMirrored.timestamp.getTime() === mirroredChat.lastMessageAt.getTime()
      ) {
        // Extrair conteúdo sem a assinatura (**AgentName**\n)
        const contentWithoutSignature = newContent.replace(/^\*\*[^*]+\*\*\n/, '');
        const [updatedChat] = await targetTenantDb
          .update(chat)
          .set({
            lastMessageContent: contentWithoutSignature,
          })
          .where(eq(chat.id, mirroredChat.id))
          .returning();

        // Emitir evento de chat atualizado na org target
        if (updatedChat) {
          await this.eventPublisher.chatUpdated(targetOrgId, updatedChat);
        }
      }
    }
  }

  /**
   * Espelha deleção de mensagem
   */
  async mirrorDelete(
    sourceOrgId: string,
    sourceTenantDb: TenantDB,
    sourceChat: Chat,
    originalMessageId: string,
  ): Promise<void> {
    const targetOrgId = await this.getTargetOrgId(sourceTenantDb, sourceChat);
    if (!targetOrgId) return;

    const targetTenantDb = await this.getTenantConnection(targetOrgId);

    // Buscar contact na org target
    const sourceContact = await this.findSourceContact(
      targetTenantDb,
      targetOrgId,
      sourceOrgId,
    );

    if (!sourceContact) return;

    // Buscar chat espelhado ativo
    const mirroredChat = await this.findActiveMirroredChat(
      targetTenantDb,
      sourceContact.id,
    );

    if (!mirroredChat) return;

    // Buscar mensagem espelhada pelo originalMessageId
    const [mirroredMessage] = await targetTenantDb
      .select()
      .from(message)
      .where(
        and(
          eq(message.chatId, mirroredChat.id),
          sql`${message.metadata}->>'originalMessageId' = ${originalMessageId}`,
        ),
      )
      .limit(1);

    if (!mirroredMessage) return;

    // Soft delete mensagem espelhada
    const [deletedMirrored] = await targetTenantDb
      .update(message)
      .set({
        isDeleted: true,
        content: "Esta mensagem foi excluída",
      })
      .where(eq(message.id, mirroredMessage.id))
      .returning();

    // Emitir evento na org target
    if (deletedMirrored) {
      await this.eventPublisher.messageUpdated(
        targetOrgId,
        mirroredChat.id,
        deletedMirrored,
      );

      // Se a mensagem deletada estava como não lida, decrementar unreadCount
      // Para chats internos, decrementar chatParticipant.unreadCount de TODOS os participants
      if (mirroredMessage.status !== "read") {
        // Decrementar unreadCount de todos os participants desse chat
        await targetTenantDb
          .update(chatParticipant)
          .set({
            unreadCount: sql`GREATEST(${chatParticipant.unreadCount} - 1, 0)`,
          })
          .where(
            and(
              eq(chatParticipant.chatId, mirroredChat.id),
              eq(chatParticipant.chatCreatedAt, mirroredChat.createdAt),
            ),
          );

        // Também decrementar chat.unreadCount (usado para pending chats)
        await targetTenantDb
          .update(chat)
          .set({
            unreadCount: sql`GREATEST(${chat.unreadCount} - 1, 0)`,
          })
          .where(eq(chat.id, mirroredChat.id));
      }

      // Buscar chat atualizado para emitir evento com unreadCount correto
      const [updatedChat] = await targetTenantDb
        .select()
        .from(chat)
        .where(eq(chat.id, mirroredChat.id))
        .limit(1);

      // Emitir evento de chat atualizado na org target para atualizar sidebar em tempo real
      if (updatedChat) {
        await this.eventPublisher.chatUpdated(targetOrgId, updatedChat);
      }
    }
  }

  // ========== Private Helper Methods ==========

  private async findOrCreateSourceContact(
    targetTenantDb: TenantDB,
    targetOrgId: string,
    sourceOrgId: string,
    sourceOrg: { name: string; logo: string | null; instanceCode: string | null },
    timestamp: Date,
  ): Promise<Contact | undefined> {
    // Buscar contact existente
    const existingContacts = await targetTenantDb
      .select()
      .from(contact)
      .where(eq(contact.organizationId, targetOrgId));

    let sourceContact = existingContacts.find(
      (c: Contact) =>
        c.metadata?.source === "internal" &&
        c.metadata.targetOrganizationId === sourceOrgId,
    );

    if (!sourceContact) {
      const [newContact] = await targetTenantDb
        .insert(contact)
        .values({
          organizationId: targetOrgId,
          phoneNumber: undefined,
          name: sourceOrg.name,
          avatar: sourceOrg.logo ?? undefined,
          metadata: {
            source: "internal",
            targetOrganizationId: sourceOrgId,
            targetOrganizationName: sourceOrg.name,
            targetOrganizationInstanceCode: sourceOrg.instanceCode ?? undefined,
            firstMessageAt: timestamp,
          },
        })
        .returning();

      sourceContact = newContact;
    }

    return sourceContact;
  }

  private async findSourceContact(
    targetTenantDb: TenantDB,
    targetOrgId: string,
    sourceOrgId: string,
  ): Promise<Contact | undefined> {
    const contacts = await targetTenantDb
      .select()
      .from(contact)
      .where(eq(contact.organizationId, targetOrgId));

    return contacts.find(
      (c: Contact) =>
        c.metadata?.source === "internal" &&
        c.metadata.targetOrganizationId === sourceOrgId,
    );
  }

  private async findActiveMirroredChat(
    targetTenantDb: TenantDB,
    sourceContactId: string,
  ): Promise<Chat | undefined> {
    const [mirroredChat] = await targetTenantDb
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.messageSource, "internal"),
          eq(chat.contactId, sourceContactId),
          or(eq(chat.status, "pending"), eq(chat.status, "open")),
        ),
      )
      .limit(1);

    return mirroredChat;
  }

  private async updateMirroredChatAfterMessage(
    targetTenantDb: TenantDB,
    mirroredChat: Chat,
    messageContent: string,
    timestamp: Date,
  ): Promise<void> {
    if (mirroredChat.assignedTo) {
      // Chat ASSIGNED: não incrementar chat.unreadCount, apenas participants
      await targetTenantDb
        .update(chat)
        .set({
          lastMessageAt: timestamp,
          lastMessageContent: messageContent,
          lastMessageSender: "agent",
          lastMessageStatus: "delivered",
          totalMessages: sql`${chat.totalMessages} + 1`,
          updatedAt: timestamp,
        })
        .where(eq(chat.id, mirroredChat.id));

      // Para chats cross-org, criar participants para TODOS os agents da org
      // (não só para quem está assigned)
      // Como estamos na tenantDb, todos os agents já são da org correta
      const allAgents = await targetTenantDb
        .select({ id: agent.id })
        .from(agent);

      // Upsert participants para todos os agents
      for (const ag of allAgents) {
        await targetTenantDb
          .insert(chatParticipant)
          .values({
            chatId: mirroredChat.id,
            chatCreatedAt: mirroredChat.createdAt,
            agentId: ag.id,
            unreadCount: 1,
            lastReadAt: timestamp,
          })
          .onConflictDoUpdate({
            target: [
              chatParticipant.chatId,
              chatParticipant.chatCreatedAt,
              chatParticipant.agentId,
            ],
            set: {
              unreadCount: sql`COALESCE(${chatParticipant.unreadCount}, 0) + 1`,
              updatedAt: timestamp,
            },
          });
      }
    } else {
      // Chat PENDING: incrementar chat.unreadCount
      await targetTenantDb
        .update(chat)
        .set({
          lastMessageAt: timestamp,
          lastMessageContent: messageContent,
          lastMessageSender: "agent",
          lastMessageStatus: "delivered",
          totalMessages: sql`${chat.totalMessages} + 1`,
          unreadCount: sql`${chat.unreadCount} + 1`,
          updatedAt: timestamp,
        })
        .where(eq(chat.id, mirroredChat.id));
    }
  }
}

// Singleton instance
let crossOrgMirrorInstance: CrossOrgMirrorService | null = null;

/**
 * Get or create CrossOrgMirrorService singleton
 */
export function getCrossOrgMirrorService(
  config: CrossOrgMirrorConfig,
): CrossOrgMirrorService {
  crossOrgMirrorInstance ??= new CrossOrgMirrorService(config);
  return crossOrgMirrorInstance;
}
