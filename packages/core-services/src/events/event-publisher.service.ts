import {
  publishChatEvent,
  publishMessageEvent,
  REDIS_CHANNELS,
} from "@manylead/shared";
import { createRedisClient } from "@manylead/clients/redis";

import type { ChatEvent as SharedChatEvent, MessageEvent as SharedMessageEvent } from "@manylead/shared";
import type { Message, Chat, Contact, Agent } from "@manylead/db";

export interface EventPublisherConfig {
  redisUrl: string;
}

/**
 * EventPublisher Service
 *
 * Centraliza a publicação de eventos para o WebSocket via Redis.
 * Utiliza as funções existentes do @manylead/shared para manter compatibilidade.
 */
export class EventPublisher {
  private redisUrl: string;
  private redis: ReturnType<typeof createRedisClient>;

  constructor(config: EventPublisherConfig) {
    this.redisUrl = config.redisUrl;
    this.redis = createRedisClient({ url: config.redisUrl, preset: "pubsub" });
  }

  /**
   * Publica evento de nova mensagem
   */
  async messageCreated(
    organizationId: string,
    chatId: string,
    message: Message,
    options?: {
      senderId?: string;
      targetAgentId?: string;
      sender?: Agent;
      attachment?: unknown;
    },
  ): Promise<void> {
    // Incluir attachment se fornecido
    const messageData = options?.attachment
      ? { ...message, attachment: options.attachment }
      : message;

    const event: SharedMessageEvent = {
      type: "message:new",
      organizationId,
      chatId,
      messageId: message.id,
      senderId: options?.senderId,
      targetAgentId: options?.targetAgentId,
      data: {
        message: messageData as unknown as Record<string, unknown>,
        sender: options?.sender as unknown as Record<string, unknown>,
      },
    };

    // Publicar evento para WebSocket (canal message:events)
    await publishMessageEvent(event, this.redisUrl);

    // Publicar evento para auto-cancelamento (canal chat:events)
    // Determinar se é mensagem de contato ou agente local
    // - senderId NULL = contato (ou agente remoto em cross-org)
    // - senderId preenchido = agente local
    const senderType: "contact" | "agent" =
      message.senderId ? "agent" : "contact";

    await this.publishAutoCancelEvent(organizationId, chatId, message.id, senderType);
  }

  /**
   * Publica evento de mensagem atualizada (edit, status change)
   */
  async messageUpdated(
    organizationId: string,
    chatId: string,
    message: Message,
    options?: {
      senderId?: string;
      targetAgentId?: string;
    },
  ): Promise<void> {
    const event: SharedMessageEvent = {
      type: "message:updated",
      organizationId,
      chatId,
      messageId: message.id,
      senderId: options?.senderId,
      targetAgentId: options?.targetAgentId,
      data: {
        message: message as unknown as Record<string, unknown>,
      },
    };

    await publishMessageEvent(event, this.redisUrl);
  }

  /**
   * Publica evento de mensagem deletada
   */
  async messageDeleted(
    organizationId: string,
    chatId: string,
    message: Message,
    options?: {
      senderId?: string;
    },
  ): Promise<void> {
    const event: SharedMessageEvent = {
      type: "message:deleted",
      organizationId,
      chatId,
      messageId: message.id,
      senderId: options?.senderId,
      data: {
        message: message as unknown as Record<string, unknown>,
      },
    };

    await publishMessageEvent(event, this.redisUrl);
  }

  /**
   * Publica evento para auto-cancelamento de scheduled messages
   * @private
   */
  private async publishAutoCancelEvent(
    organizationId: string,
    chatId: string,
    messageId: string,
    sender: "contact" | "agent",
  ): Promise<void> {
    const event = {
      type: "message:created",
      organizationId,
      chatId,
      data: {
        messageId,
        sender,
      },
    };

    await this.redis.publish(REDIS_CHANNELS.CHAT, JSON.stringify(event));
  }

  /**
   * Publica evento de chat criado
   */
  async chatCreated(
    organizationId: string,
    chat: Chat,
    options?: {
      contact?: Contact;
      assignedAgent?: Agent;
      targetAgentId?: string;
    },
  ): Promise<void> {
    const event: SharedChatEvent = {
      type: "chat:created",
      organizationId,
      chatId: chat.id,
      targetAgentId: options?.targetAgentId,
      data: {
        chat: chat as unknown as Record<string, unknown>,
        contact: options?.contact as unknown as Record<string, unknown>,
        assignedAgent: options?.assignedAgent as unknown as Record<string, unknown>,
      },
    };

    await publishChatEvent(event, this.redisUrl);
  }

  /**
   * Publica evento de chat atualizado
   */
  async chatUpdated(
    organizationId: string,
    chat: Chat,
    options?: {
      contact?: Contact;
      assignedAgent?: Agent;
      targetAgentId?: string;
    },
  ): Promise<void> {
    const event: SharedChatEvent = {
      type: "chat:updated",
      organizationId,
      chatId: chat.id,
      targetAgentId: options?.targetAgentId,
      data: {
        chat: chat as unknown as Record<string, unknown>,
        contact: options?.contact as unknown as Record<string, unknown>,
        assignedAgent: options?.assignedAgent as unknown as Record<string, unknown>,
      },
    };

    await publishChatEvent(event, this.redisUrl);
  }

  /**
   * Publica evento de chat deletado
   */
  async chatDeleted(
    organizationId: string,
    chat: Chat,
  ): Promise<void> {
    const event: SharedChatEvent = {
      type: "chat:deleted",
      organizationId,
      chatId: chat.id,
      data: {
        chat: chat as unknown as Record<string, unknown>,
      },
    };

    await publishChatEvent(event, this.redisUrl);
  }
}

// Singleton instance
let eventPublisherInstance: EventPublisher | null = null;

/**
 * Get or create EventPublisher singleton
 */
export function getEventPublisher(redisUrl: string): EventPublisher {
  eventPublisherInstance ??= new EventPublisher({ redisUrl });
  return eventPublisherInstance;
}
