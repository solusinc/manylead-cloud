import {
  chat,
  message,
  contact,
  channel,
  ending,
  organizationSettings,
  eq,
  and,
} from "@manylead/db";
import type { TenantDB, Chat, Channel, Contact, Message } from "@manylead/db";

import { getEventPublisher } from "../events";
import type { EventPublisher } from "../events";

/**
 * Resultado da verificação de ação pós-fechamento
 */
export interface PostCloseAction {
  type: "rating" | "closing" | "none";
  message: string | null;
}

/**
 * Contexto para ações pós-fechamento
 */
export interface PostActionContext {
  organizationId: string;
  tenantDb: TenantDB;
}

/**
 * Input para processar ações pós-fechamento
 */
export interface ProcessPostCloseInput {
  chatId: string;
  chatCreatedAt: Date;
  endingId?: string;
}

/**
 * Chat Post Actions Service
 *
 * Responsável por determinar e executar ações após o fechamento de um chat:
 * - Enviar pedido de rating (avaliação 1-5)
 * - Enviar mensagem de fechamento
 *
 * Regras de prioridade:
 * 1. Se rating enabled (global OU ending): enviar rating, NÃO enviar closing
 * 2. Se rating disabled E ending tem message: enviar ending message
 * 3. Se rating disabled E ending sem message: enviar closingMessage da org
 */
export class ChatPostActionsService {
  private eventPublisher: EventPublisher;

  constructor(redisUrl: string) {
    this.eventPublisher = getEventPublisher(redisUrl);
  }

  /**
   * Determinar qual ação executar após fechar o chat
   */
  async determinePostCloseAction(
    ctx: PostActionContext,
    endingId?: string,
  ): Promise<PostCloseAction> {
    // Buscar settings da organização
    const [settings] = await ctx.tenantDb
      .select({
        ratingEnabled: organizationSettings.ratingEnabled,
        closingMessage: organizationSettings.closingMessage,
      })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, ctx.organizationId))
      .limit(1);

    const globalRatingEnabled = settings?.ratingEnabled ?? false;

    // Se tem ending, verificar comportamento específico
    if (endingId) {
      const [endingRecord] = await ctx.tenantDb
        .select({
          ratingBehavior: ending.ratingBehavior,
          endingMessage: ending.endingMessage,
        })
        .from(ending)
        .where(eq(ending.id, endingId))
        .limit(1);

      if (endingRecord) {
        // Ending force-enable rating
        if (endingRecord.ratingBehavior === "enabled") {
          return {
            type: "rating",
            message: "Avalie este atendimento com uma nota entre 1 e 5 (sendo 1 para muito ruim e 5 para muito bom). Por favor, digite apenas o número correspondente.",
          };
        }

        // Ending force-disable rating
        if (endingRecord.ratingBehavior === "disabled") {
          // Usar ending message ou fallback para org closing message
          const closingMsg = endingRecord.endingMessage?.trim()
            ? endingRecord.endingMessage
            : settings?.closingMessage ?? null;
          return {
            type: "closing",
            message: closingMsg,
          };
        }

        // Ending usa default - seguir global
        if (globalRatingEnabled) {
          return {
            type: "rating",
            message: "Avalie este atendimento com uma nota entre 1 e 5 (sendo 1 para muito ruim e 5 para muito bom). Por favor, digite apenas o número correspondente.",
          };
        }

        // Global rating disabled, usar ending message ou fallback
        const defaultClosingMsg = endingRecord.endingMessage?.trim()
          ? endingRecord.endingMessage
          : settings?.closingMessage ?? null;
        return {
          type: "closing",
          message: defaultClosingMsg,
        };
      }
    }

    // Sem ending, usar settings globais
    if (globalRatingEnabled) {
      return {
        type: "rating",
        message: "Avalie este atendimento com uma nota entre 1 e 5 (sendo 1 para muito ruim e 5 para muito bom). Por favor, digite apenas o número correspondente.",
      };
    }

    return {
      type: "closing",
      message: settings?.closingMessage ?? null,
    };
  }

  /**
   * Executar ação pós-fechamento
   *
   * @returns A mensagem criada ou null se nenhuma ação foi executada
   */
  async executePostCloseAction(
    ctx: PostActionContext,
    chatRecord: Chat,
    action: PostCloseAction,
  ): Promise<Message | null> {
    if (action.type === "none" || !action.message) {
      return null;
    }

    // Rating/closing messages são apenas para WhatsApp
    // Para chats internos (cross-org), não enviamos rating/closing
    if (chatRecord.messageSource !== "whatsapp") {
      return null;
    }

    const now = new Date();
    const systemEventType =
      action.type === "rating" ? "rating_request" : "closing_message";

    // Criar mensagem de sistema
    const [newMessage] = await ctx.tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource: chatRecord.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: action.message,
        status: "sent",
        timestamp: now,
        metadata: {
          systemEventType,
        },
      })
      .returning();

    // Atualizar lastMessage apenas para rating_request (deve aparecer na sidebar)
    // Closing message NÃO deve aparecer na sidebar
    if (action.type === "rating") {
      await ctx.tenantDb
        .update(chat)
        .set({
          ratingStatus: "awaiting",
          lastMessageAt: now,
          lastMessageContent: action.message,
          lastMessageSender: "agent",
          lastMessageStatus: "sent",
          lastMessageType: "system",
        })
        .where(
          and(eq(chat.id, chatRecord.id), eq(chat.createdAt, chatRecord.createdAt)),
        );
    }

    // Emitir evento de nova mensagem (Redis - para outros serviços)
    if (newMessage) {
      await this.eventPublisher.messageCreated(
        ctx.organizationId,
        chatRecord.id,
        newMessage,
      );
    }

    return newMessage ?? null;
  }

  /**
   * Buscar dados necessários para enviar mensagem WhatsApp
   */
  async getChatWhatsAppData(
    ctx: PostActionContext,
    chatId: string,
    chatCreatedAt: Date,
  ): Promise<{
    chat: Chat;
    channel: Channel | null;
    contact: Contact;
  } | null> {
    const [result] = await ctx.tenantDb
      .select({
        chat,
        channel,
        contact,
      })
      .from(chat)
      .innerJoin(contact, eq(chat.contactId, contact.id))
      .leftJoin(channel, eq(chat.channelId, channel.id))
      .where(
        and(eq(chat.id, chatId), eq(chat.createdAt, chatCreatedAt)),
      )
      .limit(1);

    if (!result) return null;

    return {
      chat: result.chat,
      channel: result.channel,
      contact: result.contact,
    };
  }

  /**
   * Salvar agradecimento do rating
   */
  async saveRatingThanks(
    ctx: PostActionContext,
    chatRecord: Chat,
  ): Promise<void> {
    const now = new Date();
    const thankYouMessage = "Agradecemos a sua avaliação!";

    const [newMessage] = await ctx.tenantDb
      .insert(message)
      .values({
        chatId: chatRecord.id,
        messageSource: chatRecord.messageSource,
        sender: "system",
        senderId: null,
        messageType: "system",
        content: thankYouMessage,
        status: "sent",
        timestamp: now,
        metadata: {
          systemEventType: "rating_thanks",
        },
      })
      .returning();

    // NÃO atualizar lastMessage - mensagens de rating/agradecimento não devem aparecer na sidebar

    if (newMessage) {
      await this.eventPublisher.messageCreated(
        ctx.organizationId,
        chatRecord.id,
        newMessage,
      );
    }
  }
}

// Singleton
let chatPostActionsServiceInstance: ChatPostActionsService | null = null;

export function getChatPostActionsService(
  redisUrl: string,
): ChatPostActionsService {
  chatPostActionsServiceInstance ??= new ChatPostActionsService(redisUrl);
  return chatPostActionsServiceInstance;
}
