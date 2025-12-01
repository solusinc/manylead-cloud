import { and, attachment, chat, eq, message, or, sql } from "@manylead/db";
import type { TenantDB, Chat, Message } from "@manylead/db";
import { storage } from "@manylead/storage";

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

    // Criar mensagem local
    const [newMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: input.chatId,
        messageSource: chatRecord.messageSource,
        sender: "agent",
        senderId: input.agentId,
        senderName: agentName, // Nome do agente no momento do envio
        messageType: input.messageType ?? "text",
        content: input.content, // Conteúdo sem assinatura
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

    // Criar attachment se fornecido
    let createdAttachment = null;
    if (input.attachmentData) {
      const [attachmentRecord] = await tenantDb.insert(attachment).values({
        messageId: newMessage.id,
        fileName: input.attachmentData.fileName,
        mimeType: input.attachmentData.mimeType,
        mediaType: input.attachmentData.mediaType,
        storagePath: input.attachmentData.storagePath,
        storageUrl: input.attachmentData.storageUrl,
        fileSize: input.attachmentData.fileSize ?? null,
        width: input.attachmentData.width ?? null,
        height: input.attachmentData.height ?? null,
        duration: input.attachmentData.duration ?? null,
        downloadStatus: "completed",
        downloadedAt: now,
      }).returning();

      createdAttachment = attachmentRecord;
    }

    // Atualizar chat
    const updatedChat = await this.updateChatAfterMessage(
      tenantDb,
      chatRecord,
      input.content,
      now,
      "sent",
    );

    // Emitir evento para org original (sempre)
    await this.eventPublisher.messageCreated(
      organizationId,
      chatRecord.id,
      newMessage,
      {
        senderId: input.agentId,
        attachment: createdAttachment ?? undefined,
      },
    );

    // Espelhamento cross-org (se aplicável)
    if (this.crossOrgMirror.shouldMirror(chatRecord)) {
      await this.handleCrossOrgMirroring(
        organizationId,
        tenantDb,
        updatedChat, // Usar updatedChat ao invés de chatRecord
        newMessage.id,
        newMessage.timestamp,
        input.content,
        agentName,
        input.metadata,
        input.attachmentData,
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

    const now = new Date();

    // Atualizar mensagem
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        content: input.content, // Conteúdo sem assinatura
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
        input.content,
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

    // Buscar attachment da mensagem (se houver)
    const [messageAttachment] = await tenantDb
      .select()
      .from(attachment)
      .where(eq(attachment.messageId, messageId))
      .limit(1);

    // Deletar attachment do R2 (se houver)
    if (messageAttachment?.storagePath) {
      try {
        await storage.delete(messageAttachment.storagePath);
      } catch (error) {
        console.error("Erro ao deletar arquivo do R2:", error);
        // Não falhar a operação se o arquivo já foi deletado ou não existe
      }

      // Deletar attachment do banco
      await tenantDb
        .delete(attachment)
        .where(eq(attachment.messageId, messageId));
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

    // Se a mensagem deletada estava como não lida, decrementar unreadCount
    if (existingMessage.status !== "read") {
      await tenantDb
        .update(chat)
        .set({
          unreadCount: sql`GREATEST(${chat.unreadCount} - 1, 0)`,
        })
        .where(eq(chat.id, chatId));
    }

    // Buscar chat atualizado para emitir evento com unreadCount correto
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(eq(chat.id, chatId))
      .limit(1);

    // Emitir evento de chat atualizado para atualizar sidebar em tempo real
    if (chatRecord) {
      await this.eventPublisher.chatUpdated(organizationId, chatRecord);
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

    // Verificar se alguma mensagem atualizada é a última do chat
    if (updatedMessages.length > 0 && chatRecord.lastMessageAt) {
      const lastMessageTimestamp = chatRecord.lastMessageAt.getTime();
      const hasLastMessage = updatedMessages.some(
        (msg) => msg.timestamp.getTime() === lastMessageTimestamp,
      );

      if (hasLastMessage) {
        // Atualizar lastMessageStatus no chat atual
        await tenantDb
          .update(chat)
          .set({
            lastMessageStatus: "read",
          })
          .where(eq(chat.id, chatId));
      }
    }

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
    messageStatus?: "pending" | "sent" | "delivered" | "read" | "failed",
  ): Promise<Chat> {
    const [updatedChat] = await tenantDb
      .update(chat)
      .set({
        lastMessageAt: timestamp,
        lastMessageContent: messageContent,
        lastMessageSender: "agent",
        lastMessageStatus: messageStatus ?? "sent",
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
    senderName: string,
    metadata?: Record<string, unknown>,
    attachmentData?: CreateMessageInput["attachmentData"],
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
        senderName,
        metadata,
        attachmentData,
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
        senderName,
        metadata,
        attachmentData,
      );
    }

    // Após espelhar, atualizar mensagem original para "delivered"
    const now = new Date();
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        status: "delivered",
        deliveredAt: now,
      })
      .where(
        and(
          eq(message.id, messageId),
          eq(message.timestamp, messageTimestamp),
        ),
      )
      .returning();

    // Atualizar lastMessageStatus do chat se essa for a última mensagem
    if (updatedMessage && chatRecord.lastMessageAt?.getTime() === messageTimestamp.getTime()) {
      await tenantDb
        .update(chat)
        .set({
          lastMessageStatus: "delivered",
        })
        .where(eq(chat.id, chatRecord.id));
    }

    // Emitir evento de status atualizado (delivered)
    if (updatedMessage) {
      await this.eventPublisher.messageUpdated(
        organizationId,
        chatRecord.id,
        updatedMessage,
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
