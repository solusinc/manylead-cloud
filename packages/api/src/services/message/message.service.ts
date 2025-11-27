import { and, chat, eq, message, or, sql } from "@manylead/db";
import type { TenantDB, Chat, Message } from "@manylead/db";

import { getEventPublisher } from "../events";
import type { EventPublisher } from "../events";
import { getCrossOrgMirrorService } from "../cross-org";
import type { CrossOrgMirrorService } from "../cross-org";
import type {
  MessageServiceConfig,
  CreateMessageInput,
  UpdateMessageInput,
  MessageContext,
  CreateMessageResult,
} from "./message.types";

/**
 * MessageService
 *
 * Responsável por todas as operações de mensagens:
 * - Criação, edição, deleção
 * - Atualização de status (read, delivered)
 * - Orquestração de espelhamento cross-org
 * - Publicação de eventos
 */
export class MessageService {
  private eventPublisher: EventPublisher;
  private crossOrgMirror: CrossOrgMirrorService;

  constructor(config: MessageServiceConfig) {
    this.eventPublisher = getEventPublisher(config.redisUrl);
    this.crossOrgMirror = getCrossOrgMirrorService(config);
  }

  /**
   * Cria uma nova mensagem de texto
   */
  async createTextMessage(
    ctx: MessageContext,
    input: CreateMessageInput,
  ): Promise<CreateMessageResult> {
    const { tenantDb, organizationId, agentName } = ctx;

    // Buscar chat
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(eq(chat.id, input.chatId))
      .limit(1);

    if (!chatRecord) {
      throw new Error("Chat não encontrado");
    }

    const now = new Date();
    const formattedContent = `**${agentName}**\n${input.content}`;

    // Criar mensagem local
    const [newMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: input.chatId,
        messageSource: chatRecord.messageSource,
        sender: "agent",
        senderId: input.agentId,
        messageType: input.messageType ?? "text",
        content: formattedContent,
        repliedToMessageId: input.repliedToMessageId ?? null,
        metadata: input.tempId
          ? { ...input.metadata, tempId: input.tempId }
          : input.metadata,
        status: "sent",
        timestamp: now,
        sentAt: now,
      })
      .returning();

    if (!newMessage) {
      throw new Error("Erro ao criar mensagem");
    }

    // Atualizar chat
    const updatedChat = await this.updateChatAfterMessage(
      tenantDb,
      chatRecord,
      input.content,
      now,
    );

    // Emitir evento local
    await this.eventPublisher.messageCreated(
      organizationId,
      chatRecord.id,
      newMessage,
      { senderId: input.agentId },
    );

    // Espelhamento cross-org (se aplicável)
    if (this.crossOrgMirror.shouldMirror(chatRecord)) {
      await this.handleCrossOrgMirroring(
        organizationId,
        tenantDb,
        chatRecord,
        newMessage.id,
        newMessage.timestamp,
        formattedContent,
        input.metadata,
      );
    }

    return {
      message: newMessage,
      chat: updatedChat,
    };
  }

  /**
   * Edita uma mensagem existente
   */
  async editMessage(
    ctx: MessageContext,
    messageId: string,
    timestamp: Date,
    chatId: string,
    input: UpdateMessageInput,
  ): Promise<Message> {
    const { tenantDb, organizationId, agentName } = ctx;

    // Buscar mensagem
    const [existingMessage] = await tenantDb
      .select()
      .from(message)
      .where(
        and(eq(message.id, messageId), eq(message.timestamp, timestamp)),
      )
      .limit(1);

    if (!existingMessage) {
      throw new Error("Mensagem não encontrada");
    }

    const now = new Date();
    const formattedContent = `**${agentName}**\n${input.content}`;

    // Atualizar mensagem
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        content: formattedContent,
        isEdited: true,
        editedAt: now,
      })
      .where(eq(message.id, messageId))
      .returning();

    if (!updatedMessage) {
      throw new Error("Erro ao atualizar mensagem");
    }

    // Emitir evento local
    await this.eventPublisher.messageUpdated(organizationId, chatId, updatedMessage);

    // Buscar chat para verificar se precisa atualizar lastMessageContent
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    // Se a mensagem editada é a última mensagem do chat, atualizar também o chat
    if (
      chatRecord?.lastMessageAt &&
      updatedMessage.timestamp.getTime() === chatRecord.lastMessageAt.getTime()
    ) {
      const [updatedChat] = await tenantDb
        .update(chat)
        .set({
          lastMessageContent: input.content,
        })
        .where(eq(chat.id, chatId))
        .returning();

      // Emitir evento de chat atualizado
      if (updatedChat) {
        await this.eventPublisher.chatUpdated(organizationId, updatedChat);
      }
    }

    if (chatRecord && this.crossOrgMirror.shouldMirror(chatRecord)) {
      await this.crossOrgMirror.mirrorEdit(
        organizationId,
        tenantDb,
        chatRecord,
        messageId,
        formattedContent,
      );
    }

    return updatedMessage;
  }

  /**
   * Deleta (soft delete) uma mensagem
   */
  async deleteMessage(
    ctx: MessageContext,
    messageId: string,
    timestamp: Date,
    chatId: string,
  ): Promise<Message> {
    const { tenantDb, organizationId } = ctx;

    // Buscar mensagem
    const [existingMessage] = await tenantDb
      .select()
      .from(message)
      .where(
        and(eq(message.id, messageId), eq(message.timestamp, timestamp)),
      )
      .limit(1);

    if (!existingMessage) {
      throw new Error("Mensagem não encontrada");
    }

    // Soft delete
    const [deletedMessage] = await tenantDb
      .update(message)
      .set({
        isDeleted: true,
        content: "Esta mensagem foi excluída",
      })
      .where(eq(message.id, messageId))
      .returning();

    if (!deletedMessage) {
      throw new Error("Erro ao deletar mensagem");
    }

    // Emitir evento local
    await this.eventPublisher.messageUpdated(organizationId, chatId, deletedMessage);

    // Buscar chat para verificar se precisa atualizar lastMessageContent
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    // Se a mensagem deletada era a última mensagem do chat, buscar a anterior
    if (
      chatRecord?.lastMessageAt &&
      deletedMessage.timestamp.getTime() === chatRecord.lastMessageAt.getTime()
    ) {
      // Buscar a mensagem anterior não deletada
      const [previousMessage] = await tenantDb
        .select()
        .from(message)
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.isDeleted, false),
          ),
        )
        .orderBy(sql`${message.timestamp} DESC`)
        .limit(1);

      // Atualizar chat com a mensagem anterior ou limpar se não houver
      // Extrair conteúdo sem assinatura se houver mensagem anterior
      let lastContent = null;
      if (previousMessage?.content) {
        // Remover assinatura se for mensagem de agent, senão manter original
        lastContent = previousMessage.sender === "agent"
          ? previousMessage.content.replace(/^\*\*[^*]+\*\*\n/, '')
          : previousMessage.content;
      }

      const [updatedChat] = await tenantDb
        .update(chat)
        .set({
          lastMessageAt: previousMessage?.timestamp ?? null,
          lastMessageContent: lastContent,
          lastMessageSender: previousMessage?.sender ?? null,
        })
        .where(eq(chat.id, chatId))
        .returning();

      // Emitir evento de chat atualizado
      if (updatedChat) {
        await this.eventPublisher.chatUpdated(organizationId, updatedChat);
      }
    }

    if (chatRecord && this.crossOrgMirror.shouldMirror(chatRecord)) {
      await this.crossOrgMirror.mirrorDelete(
        organizationId,
        tenantDb,
        chatRecord,
        messageId,
      );
    }

    return deletedMessage;
  }

  /**
   * Marca todas as mensagens de um chat como lidas
   */
  async markAllAsRead(
    ctx: MessageContext,
    chatId: string,
  ): Promise<void> {
    const { tenantDb, organizationId, agentId } = ctx;

    const now = new Date();

    // Buscar chat
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    if (!chatRecord) {
      throw new Error("Chat não encontrado");
    }

    // Atualizar APENAS mensagens não lidas que NÃO são do agent atual
    // Para WhatsApp: sender = "contact"
    // Para Internal: senderId IS NULL (de outra org) ou senderId != agentId
    const updatedMessages = await tenantDb
      .update(message)
      .set({
        status: "read",
        readAt: now,
      })
      .where(
        and(
          eq(message.chatId, chatId),
          sql`${message.status} != 'read'`,
          or(
            eq(message.sender, "contact"),
            sql`${message.senderId} IS NULL`,
            sql`${message.senderId} != ${agentId}`,
          ),
        ),
      )
      .returning();

    // Emitir eventos para cada mensagem atualizada
    for (const msg of updatedMessages) {
      await this.eventPublisher.messageUpdated(organizationId, chatId, msg);
    }

    // Espelhar status de leitura cross-org (se aplicável)
    if (this.crossOrgMirror.shouldMirror(chatRecord)) {
      await this.crossOrgMirror.mirrorReadStatus(
        organizationId,
        tenantDb,
        chatRecord,
      );
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Atualiza o chat após criar uma mensagem
   */
  private async updateChatAfterMessage(
    tenantDb: TenantDB,
    chatRecord: Chat,
    messageContent: string,
    timestamp: Date,
  ): Promise<Chat> {
    const [updatedChat] = await tenantDb
      .update(chat)
      .set({
        lastMessageAt: timestamp,
        lastMessageContent: messageContent,
        lastMessageSender: "agent",
        totalMessages: sql`${chat.totalMessages} + 1`,
        updatedAt: timestamp,
      })
      .where(eq(chat.id, chatRecord.id))
      .returning();

    return updatedChat ?? chatRecord;
  }

  /**
   * Determina se é a primeira mensagem TEXT do chat e espelha adequadamente
   */
  private async handleCrossOrgMirroring(
    organizationId: string,
    tenantDb: TenantDB,
    chatRecord: Chat,
    messageId: string,
    messageTimestamp: Date,
    messageContent: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Contar mensagens TEXT do chat (excluindo SYSTEM)
    const textMessagesCount = await tenantDb
      .select({ count: sql<number>`count(*)` })
      .from(message)
      .where(
        and(
          eq(message.chatId, chatRecord.id),
          sql`${message.messageType} != 'system'`,
        ),
      );

    const isFirstTextMessage = Number(textMessagesCount[0]?.count ?? 0) === 1;

    if (isFirstTextMessage) {
      // Primeira mensagem: criar contact e chat na org target
      await this.crossOrgMirror.mirrorFirstMessage(
        organizationId,
        tenantDb,
        chatRecord,
        messageId,
        messageTimestamp,
        messageContent,
        metadata,
      );
    } else {
      // Mensagem subsequente: espelhar no chat existente
      await this.crossOrgMirror.mirrorSubsequentMessage(
        organizationId,
        tenantDb,
        chatRecord,
        messageId,
        messageTimestamp,
        messageContent,
        metadata,
      );
    }
  }
}

// Singleton instance
let messageServiceInstance: MessageService | null = null;

/**
 * Get or create MessageService singleton
 */
export function getMessageService(config: MessageServiceConfig): MessageService {
  messageServiceInstance ??= new MessageService(config);
  return messageServiceInstance;
}
