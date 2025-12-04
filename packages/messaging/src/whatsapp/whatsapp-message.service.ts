import { and, chat, contact, channel, eq, message, sql, isNotNull, inArray } from "@manylead/db";
import type { TenantDB } from "@manylead/db";
import type { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { formatMessageWithSignature } from "@manylead/core-services";

import { WhatsAppSenderService } from "./whatsapp-sender.service";
import type {
  SendWhatsAppTextInput,
  // SendWhatsAppMediaInput,
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

  constructor(private config: WhatsAppMessageServiceConfig) {
    this.senderService = new WhatsAppSenderService(config.evolutionClient);
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

    // 2. Criar mensagem no banco com status "pending"
    const [newMessage] = await tenantDb
      .insert(message)
      .values({
        chatId: input.chatId,
        messageSource: "whatsapp",
        sender: "agent",
        senderId: input.agentId,
        senderName: input.agentName,
        messageType: "text",
        content: input.content,
        status: "pending",
        timestamp: now,
        repliedToMessageId: input.repliedToMessageId ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    if (!newMessage) {
      throw new Error("Falha ao criar mensagem");
    }

    try {
      // 3. Formatar mensagem com assinatura para envio
      const textWithSignature = formatMessageWithSignature(
        input.agentName,
        input.content,
        "whatsapp",
      );

      // 4. Se tiver repliedToMessageId, buscar mensagem original para quoted
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

      // 5. Enviar via WhatsAppSenderService
      const result = await this.senderService.sendText({
        instanceName: chatRecord.channel.evolutionInstanceName,
        phoneNumber: chatRecord.contact.phoneNumber,
        text: textWithSignature,
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
          totalMessages: sql`${chat.totalMessages} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(chat.id, input.chatId),
            eq(chat.createdAt, input.chatCreatedAt),
          ),
        );

      // 7. TODO: Emitir evento Socket.io
      // getSocketManager().emitToRoom(`org:${organizationId}`, "message:new", {...})

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

  // /**
  //  * Enviar mensagem com mídia para WhatsApp
  //  *
  //  * TODO: Fase 6 - Implementar envio de mídia
  //  *
  //  * @param tenantDb - Database do tenant
  //  * @param organizationId - ID da organização
  //  * @param input - Dados da mídia
  //  * @returns Resultado do envio
  //  */
  // async sendMediaMessage(
  //   tenantDb: TenantDB,
  //   organizationId: string,
  //   input: SendWhatsAppMediaInput,
  // ): Promise<SendMessageResult> {
  //   throw new Error("sendMediaMessage not implemented yet - Fase 6");
  // }

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
