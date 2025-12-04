import { and, chat, contact, channel, eq, message, sql, isNotNull, inArray, attachment } from "@manylead/db";
import type { TenantDB, Attachment } from "@manylead/db";
import type { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { formatMessageWithSignature, getEventPublisher } from "@manylead/core-services";
import type { EventPublisher } from "@manylead/core-services";

import { WhatsAppSenderService } from "./whatsapp-sender.service";
import type {
  SendWhatsAppTextInput,
  SendMessageResult,
  MarkAsReadInput,
  WhatsAppSendTextParams,
} from "./whatsapp-message.types";

export interface WhatsAppMessageServiceConfig {
  evolutionClient: EvolutionAPIClient;
  redisUrl: string;
}

/**
 * WhatsApp Message Service
 *
 * Camada de negócio para operações com WhatsApp.
 *
 * Responsabilidades:
 * - Orquestrar fluxo de envio de mensagens
 * - Validar chat, channel e contact
 * - Criar mensagem no banco (pending → sent/failed)
 * - Chamar WhatsAppSenderService
 * - Atualizar status e whatsappMessageId
 * - Emitir eventos Socket.io
 * - Tratar erros
 *
 * Princípios SOLID:
 * - Single Responsibility: Apenas lógica de negócio WhatsApp
 * - Open/Closed: Fácil adicionar novos tipos de mensagem
 * - Dependency Inversion: Recebe dependencies via constructor
 */
export class WhatsAppMessageService {
  private senderService: WhatsAppSenderService;
  private eventPublisher: EventPublisher;

  constructor(private config: WhatsAppMessageServiceConfig) {
    this.senderService = new WhatsAppSenderService(config.evolutionClient);
    this.eventPublisher = getEventPublisher(config.redisUrl);
  }

  /**
   * Enviar mensagem de texto para WhatsApp
   *
   * Fluxo:
   * 1. Validar chat, channel e contact
   * 2. Criar mensagem no banco (status: pending)
   * 3. Enviar via WhatsAppSenderService
   * 4. Atualizar whatsappMessageId e status: sent
   * 5. Atualizar chat (lastMessage)
   * 6. Emitir evento Socket.io
   * 7. Tratar erros (status: failed)
   *
   * @param tenantDb - Database do tenant
   * @param organizationId - ID da organização
   * @param input - Dados da mensagem
   * @returns Resultado do envio com messageId e whatsappMessageId
   */
  async sendTextMessage(
    tenantDb: TenantDB,
    organizationId: string,
    input: SendWhatsAppTextInput,
  ): Promise<SendMessageResult> {
    // STEP 1: Iniciando envio de mensagem WhatsApp

    // 1. Buscar chat com canal e contato
    const [chatRecord] = await tenantDb
      .select({
        chat,
        contact,
        channel,
      })
      .from(chat)
      .innerJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(channel, eq(chat.channelId, channel.id))
      .where(
        and(
          eq(chat.id, input.chatId),
          eq(chat.createdAt, input.chatCreatedAt),
          eq(chat.messageSource, "whatsapp"),
        ),
      )
      .limit(1);

    if (!chatRecord) {
      throw new Error("Chat não encontrado");
    }

    if (!chatRecord.channel) {
      throw new Error("Chat não possui canal configurado");
    }

    if (!chatRecord.contact.phoneNumber) {
      throw new Error("Contato não possui número de telefone");
    }

    const now = new Date();

    // 2. Detectar messageType baseado em attachmentData
    const messageType = input.attachmentData
      ? input.attachmentData.mediaType
      : "text";

    // 3. Criar mensagem no banco com status "pending"
    const [newMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: input.chatId,
        messageSource: "whatsapp",
        sender: "agent",
        senderId: input.agentId,
        senderName: input.agentName,
        messageType,
        content: input.content || `[${messageType}]`, // Default content se vazio
        status: "pending",
        timestamp: now,
        repliedToMessageId: input.repliedToMessageId ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    if (!newMessage) {
      throw new Error("Falha ao criar mensagem");
    }

    // 4. Se tem attachmentData, criar attachment
    let attachmentRecord: Attachment | undefined;
    if (input.attachmentData) {
      const [createdAttachment] = await tenantDb
        .insert(attachment)
        .values({
          messageId: newMessage.id,
          mediaType: input.attachmentData.mediaType,
          mimeType: input.attachmentData.mimeType,
          fileName: input.attachmentData.fileName,
          fileSize: input.attachmentData.fileSize ?? null,
          width: input.attachmentData.width ?? null,
          height: input.attachmentData.height ?? null,
          duration: input.attachmentData.duration ?? null,
          storagePath: input.attachmentData.storagePath,
          storageUrl: input.attachmentData.storageUrl,
          downloadStatus: "completed", // Já está no R2
        })
        .returning();

      attachmentRecord = createdAttachment;
    }

    try {
      // 5. Formatar mensagem (com ou sem assinatura)
      // IMPORTANTE: Mídia NÃO leva assinatura, só o caption puro
      const messageContent = input.attachmentData
        ? (input.content || "") // Mídia: caption puro sem assinatura
        : input.content
          ? formatMessageWithSignature(input.agentName, input.content, "whatsapp")
          : ""; // Texto: com assinatura

      // 6. Se tiver repliedToMessageId, buscar mensagem original para quoted
      let quoted: WhatsAppSendTextParams["quoted"];

      if (input.repliedToMessageId) {
        const [repliedMessage] = await tenantDb
          .select({
            whatsappMessageId: message.whatsappMessageId,
            sender: message.sender,
          })
          .from(message)
          .where(
            and(
              eq(message.id, input.repliedToMessageId),
              eq(message.chatId, input.chatId),
            ),
          )
          .limit(1);

        if (repliedMessage?.whatsappMessageId) {
          quoted = {
            key: {
              remoteJid: `${chatRecord.contact.phoneNumber}@s.whatsapp.net`,
              fromMe: repliedMessage.sender === "agent",
              id: repliedMessage.whatsappMessageId,
            },
          };
        }
      }

      // 7. Enviar via WhatsAppSenderService (sendMedia ou sendText)
      const result = input.attachmentData
        ? await this.senderService.sendMedia({
            instanceName: chatRecord.channel.evolutionInstanceName,
            phoneNumber: chatRecord.contact.phoneNumber,
            mediaType: input.attachmentData.mediaType,
            mediaUrl: input.attachmentData.storageUrl, // URL público do R2
            filename: input.attachmentData.fileName,
            caption: messageContent, // Caption puro (sem assinatura)
            quoted,
          })
        : await this.senderService.sendText({
            instanceName: chatRecord.channel.evolutionInstanceName,
            phoneNumber: chatRecord.contact.phoneNumber,
            text: messageContent, // Texto com assinatura
            quoted,
          });

      // 5. Atualizar mensagem com whatsappMessageId e status "sent"
      await tenantDb
        .update(message)
        .set({
          whatsappMessageId: result.key.id,
          status: "sent",
          sentAt: new Date(),
        })
        .where(
          and(
            eq(message.id, newMessage.id),
            eq(message.timestamp, newMessage.timestamp),
          ),
        );

      // 6. Atualizar chat (lastMessage, totalMessages)
      await tenantDb
        .update(chat)
        .set({
          lastMessageAt: now,
          lastMessageContent: input.content,
          lastMessageSender: "agent",
          lastMessageStatus: "sent",
          lastMessageType: messageType,
          lastMessageIsDeleted: false,
          totalMessages: sql`${chat.totalMessages} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(chat.id, input.chatId),
            eq(chat.createdAt, input.chatCreatedAt),
          ),
        );

      // 7. Emitir evento Socket.io
      await this.eventPublisher.messageCreated(
        organizationId,
        input.chatId,
        newMessage,
        {
          senderId: input.agentId,
          attachment: attachmentRecord,
        },
      );

      return {
        messageId: newMessage.id,
        messageCreatedAt: newMessage.timestamp,
        whatsappMessageId: result.key.id,
        status: "sent",
      };
    } catch (error) {
      // 8. Se falhar, marcar mensagem como failed
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";

      await tenantDb
        .update(message)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(
          and(
            eq(message.id, newMessage.id),
            eq(message.timestamp, newMessage.timestamp),
          ),
        );

      return {
        messageId: newMessage.id,
        messageCreatedAt: newMessage.timestamp,
        whatsappMessageId: null,
        status: "failed",
        error: {
          code: "SEND_FAILED",
          message: errorMessage,
        },
      };
    }
  }

  /**
   * Editar mensagem existente no WhatsApp
   *
   * Fluxo:
   * 1. Buscar mensagem original com chat, channel e contact
   * 2. Validar que mensagem é do agente (sender: "agent")
   * 3. Chamar Evolution API para editar no WhatsApp
   * 4. Atualizar no banco: content, isEdited, editedAt
   * 5. Se é última mensagem, atualizar chat.lastMessageContent
   * 6. Emitir evento Socket.io message:updated
   *
   * @param tenantDb - Database do tenant
   * @param organizationId - ID da organização
   * @param messageId - ID da mensagem
   * @param timestamp - Timestamp da mensagem (composite key)
   * @param chatId - ID do chat
   * @param newContent - Novo conteúdo da mensagem
   * @returns Mensagem atualizada
   */
  async editMessage(
    tenantDb: TenantDB,
    organizationId: string,
    messageId: string,
    timestamp: Date,
    chatId: string,
    newContent: string,
  ): Promise<typeof message.$inferSelect> {
    // 1. Buscar mensagem com chat, channel e contact
    const [messageRecord] = await tenantDb
      .select({
        message,
        chat,
        contact,
        channel,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .innerJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(channel, eq(chat.channelId, channel.id))
      .where(
        and(
          eq(message.id, messageId),
          eq(message.timestamp, timestamp),
          eq(message.chatId, chatId),
        ),
      )
      .limit(1);

    if (!messageRecord) {
      throw new Error("Mensagem não encontrada");
    }

    // 2. Validar que mensagem é do agente
    if (messageRecord.message.sender !== "agent") {
      throw new Error("Apenas mensagens enviadas pelo agente podem ser editadas");
    }

    if (!messageRecord.message.whatsappMessageId) {
      throw new Error("Mensagem não possui whatsappMessageId");
    }

    if (!messageRecord.channel) {
      throw new Error("Chat não possui canal configurado");
    }

    if (!messageRecord.contact.phoneNumber) {
      throw new Error("Contato não possui número de telefone");
    }

    const now = new Date();

    // 3. Formatar conteúdo com assinatura do agente
    const formattedContent = formatMessageWithSignature(
      messageRecord.message.senderName ?? "Agente",
      newContent,
      "whatsapp",
    );

    // 4. Chamar Evolution API para editar no WhatsApp
    const remoteJid = `${messageRecord.contact.phoneNumber}@s.whatsapp.net`;

    try {
      await this.senderService.updateMessage({
        instanceName: messageRecord.channel.evolutionInstanceName,
        phoneNumber: messageRecord.contact.phoneNumber,
        text: formattedContent,
        remoteJid,
        fromMe: true, // Mensagem foi enviada por nós
        whatsappMessageId: messageRecord.message.whatsappMessageId,
      });
    } catch (error) {
      console.error("Failed to edit message on WhatsApp", {
        messageId,
        error,
      });
      throw new Error("Erro ao editar mensagem no WhatsApp");
    }

    // 5. Atualizar mensagem no banco
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        content: newContent, // Armazenar SEM assinatura
        isEdited: true,
        editedAt: now,
      })
      .where(
        and(
          eq(message.id, messageId),
          eq(message.timestamp, timestamp),
        ),
      )
      .returning();

    if (!updatedMessage) {
      throw new Error("Erro ao atualizar mensagem no banco");
    }

    // 6. Emitir evento Socket.io
    await this.eventPublisher.messageUpdated(
      organizationId,
      chatId,
      updatedMessage,
    );

    // 7. Se é última mensagem, atualizar chat.lastMessageContent
    if (
      messageRecord.chat.lastMessageAt &&
      updatedMessage.timestamp.getTime() === messageRecord.chat.lastMessageAt.getTime()
    ) {
      const [updatedChat] = await tenantDb
        .update(chat)
        .set({
          lastMessageContent: newContent,
        })
        .where(eq(chat.id, chatId))
        .returning();

      // Emitir evento de chat atualizado
      if (updatedChat) {
        await this.eventPublisher.chatUpdated(organizationId, updatedChat);
      }
    }

    return updatedMessage;
  }

  /**
   * Deletar mensagem no WhatsApp (para todos)
   *
   * Fluxo:
   * 1. Buscar mensagem original com chat, channel e contact
   * 2. Validar que mensagem é do agente (sender: "agent")
   * 3. Chamar Evolution API para deletar no WhatsApp
   * 4. Soft delete no banco: isDeleted: true, content: "Esta mensagem foi excluída"
   * 5. Se é última mensagem, marcar chat.lastMessageIsDeleted: true
   * 6. Emitir evento Socket.io message:updated
   *
   * @param tenantDb - Database do tenant
   * @param organizationId - ID da organização
   * @param messageId - ID da mensagem
   * @param timestamp - Timestamp da mensagem (composite key)
   * @param chatId - ID do chat
   * @returns Mensagem atualizada
   */
  async deleteMessage(
    tenantDb: TenantDB,
    organizationId: string,
    messageId: string,
    timestamp: Date,
    chatId: string,
  ): Promise<typeof message.$inferSelect> {
    // 1. Buscar mensagem com chat, channel e contact
    const [messageRecord] = await tenantDb
      .select({
        message,
        chat,
        contact,
        channel,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .innerJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(channel, eq(chat.channelId, channel.id))
      .where(
        and(
          eq(message.id, messageId),
          eq(message.timestamp, timestamp),
          eq(message.chatId, chatId),
        ),
      )
      .limit(1);

    if (!messageRecord) {
      throw new Error("Mensagem não encontrada");
    }

    // 2. Validar que mensagem é do agente
    if (messageRecord.message.sender !== "agent") {
      throw new Error("Apenas mensagens enviadas pelo agente podem ser deletadas");
    }

    if (!messageRecord.message.whatsappMessageId) {
      throw new Error("Mensagem não possui whatsappMessageId");
    }

    if (!messageRecord.channel) {
      throw new Error("Chat não possui canal configurado");
    }

    if (!messageRecord.contact.phoneNumber) {
      throw new Error("Contato não possui número de telefone");
    }

    // 3. Chamar Evolution API para deletar no WhatsApp
    const remoteJid = `${messageRecord.contact.phoneNumber}@s.whatsapp.net`;

    try {
      await this.senderService.deleteMessage({
        instanceName: messageRecord.channel.evolutionInstanceName,
        remoteJid,
        fromMe: true, // Mensagem foi enviada por nós
        whatsappMessageId: messageRecord.message.whatsappMessageId,
      });
    } catch (error) {
      console.error("Failed to delete message on WhatsApp", {
        messageId,
        error,
      });
      throw new Error("Erro ao deletar mensagem no WhatsApp");
    }

    // 4. Soft delete no banco
    const [updatedMessage] = await tenantDb
      .update(message)
      .set({
        isDeleted: true,
        content: "Esta mensagem foi excluída",
      })
      .where(
        and(
          eq(message.id, messageId),
          eq(message.timestamp, timestamp),
        ),
      )
      .returning();

    if (!updatedMessage) {
      throw new Error("Erro ao atualizar mensagem no banco");
    }

    // 5. Emitir evento Socket.io
    await this.eventPublisher.messageUpdated(
      organizationId,
      chatId,
      updatedMessage,
    );

    // 6. Se é última mensagem, marcar chat.lastMessageIsDeleted: true
    if (
      messageRecord.chat.lastMessageAt &&
      updatedMessage.timestamp.getTime() === messageRecord.chat.lastMessageAt.getTime()
    ) {
      const [updatedChat] = await tenantDb
        .update(chat)
        .set({
          lastMessageIsDeleted: true,
          lastMessageContent: "Esta mensagem foi excluída",
        })
        .where(eq(chat.id, chatId))
        .returning();

      // Emitir evento de chat atualizado
      if (updatedChat) {
        await this.eventPublisher.chatUpdated(organizationId, updatedChat);
      }
    }

    return updatedMessage;
  }

  /**
   * Marcar mensagens como lidas no WhatsApp
   *
   * Fluxo:
   * 1. Buscar chat, channel e contact
   * 2. Buscar mensagens não lidas do CONTATO (sender: "contact")
   * 3. Chamar Evolution API EM LOTE (todas mensagens de uma vez)
   * 4. Atualizar status local para "read" em lote
   * 5. Atualizar chat.lastMessageStatus se necessário
   *
   * @param tenantDb - Database do tenant
   * @param organizationId - ID da organização (não usado, mas mantido para consistência)
   * @param input - ID do chat
   */
  async markAsRead(
    tenantDb: TenantDB,
    organizationId: string,
    input: MarkAsReadInput,
  ): Promise<void> {
    // 1. Buscar chat com canal e contato
    const [chatRecord] = await tenantDb
      .select({
        chat,
        contact,
        channel,
      })
      .from(chat)
      .innerJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(channel, eq(chat.channelId, channel.id))
      .where(
        and(
          eq(chat.id, input.chatId),
          eq(chat.createdAt, input.chatCreatedAt),
          eq(chat.messageSource, "whatsapp"),
        ),
      )
      .limit(1);

    if (!chatRecord) {
      throw new Error("Chat não encontrado");
    }

    if (!chatRecord.channel) {
      throw new Error("Chat não possui canal configurado");
    }

    if (!chatRecord.contact.phoneNumber) {
      throw new Error("Contato não possui número de telefone");
    }

    // 2. Buscar mensagens não lidas do CONTATO
    // Mensagens do contato chegam com status "received", não "delivered"
    const unreadMessages = await tenantDb
      .select({
        id: message.id,
        timestamp: message.timestamp,
        whatsappMessageId: message.whatsappMessageId,
      })
      .from(message)
      .where(
        and(
          eq(message.chatId, input.chatId),
          eq(message.sender, "customer"), // customer, não contact!
          eq(message.status, "received"), // received, não delivered!
          isNotNull(message.whatsappMessageId),
        ),
      );

    if (unreadMessages.length === 0) {
      return; // Nada a marcar
    }

    const remoteJid = `${chatRecord.contact.phoneNumber}@s.whatsapp.net`;

    // 3. Preparar array de mensagens para marcar como lidas
    const messagesToMarkRead = unreadMessages
      .map((msg) => msg.whatsappMessageId)
      .filter((id): id is string => Boolean(id))
      .map((id) => ({
        remoteJid,
        fromMe: false,
        id,
      }));

    if (messagesToMarkRead.length === 0) {
      return;
    }

    try {
      // Chamar Evolution API em LOTE (performance!)
      await this.config.evolutionClient.message.markAsRead(
        chatRecord.channel.evolutionInstanceName,
        { readMessages: messagesToMarkRead },
      );

      // 4. Atualizar status local em LOTE
      const messageIds = unreadMessages.map((msg) => msg.id);
      await tenantDb
        .update(message)
        .set({
          status: "read",
          readAt: new Date(),
        })
        .where(
          and(
            eq(message.chatId, input.chatId),
            inArray(message.id, messageIds),
          ),
        );

      // 5. Atualizar chat.lastMessageStatus se necessário
      if (chatRecord.chat.lastMessageSender === "customer") {
        await tenantDb
          .update(chat)
          .set({
            lastMessageStatus: "read",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(chat.id, input.chatId),
              eq(chat.createdAt, input.chatCreatedAt),
            ),
          );
      }
    } catch (error) {
      console.error("Failed to mark messages as read", {
        chatId: input.chatId,
        messageCount: messagesToMarkRead.length,
        error,
      });
      throw error;
    }
  }
}

// Singleton instance
let whatsappMessageServiceInstance: WhatsAppMessageService | null = null;

/**
 * Get or create WhatsAppMessageService singleton
 */
export function getWhatsAppMessageService(config: WhatsAppMessageServiceConfig): WhatsAppMessageService {
  whatsappMessageServiceInstance ??= new WhatsAppMessageService(config);
  return whatsappMessageServiceInstance;
}
