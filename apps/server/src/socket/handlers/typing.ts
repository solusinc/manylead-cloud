import type { Socket, Server as SocketIOServer } from "socket.io";

import type { TenantDB } from "@manylead/db";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import { agent, and, channel, chat, contact, eq, or } from "@manylead/db";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";

import type { SocketData } from "../types";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";

const log = createLogger("TypingHandler");

/**
 * Handler para eventos de digitação (typing indicators)
 * Unifica lógica de typing:start e typing:stop
 */
export class TypingHandler {
  // Cache de presences ativas para evitar spam (chatId -> timestamp)
  private activePresences = new Map<string, number>();

  constructor(
    private io: SocketIOServer,
    private tenantManager: TenantDatabaseManager,
  ) {}

  /**
   * Processa evento de presença (online/offline)
   * @param socket - Socket do cliente
   * @param data - Dados do evento (chatId)
   * @param action - "available" ou "unavailable"
   */
  async handlePresence(
    socket: Socket,
    data: { chatId: string },
    action: "available" | "unavailable",
  ): Promise<void> {
    if (!data.chatId) {
      socket.emit("error", { message: "chatId is required" });
      return;
    }

    log.info(`← ${socket.id} | presence:${action} → chat:${data.chatId}`);

    // Rate limiting: evitar múltiplos agents enviando presence "available" ao mesmo tempo
    // unavailable sempre pode ser enviado (sem rate limiting)
    if (action === "available") {
      const now = Date.now();
      const lastSent = this.activePresences.get(data.chatId);

      // Se já enviou "available" nos últimos 60s, ignorar (outro agent já está online)
      if (lastSent && (now - lastSent) < 60000) {
        log.info({
          chatId: data.chatId,
          timeSinceLastSent: now - lastSent,
        }, "Presence already active, skipping to avoid spam");
        return;
      }
      // Marcar como ativo
      this.activePresences.set(data.chatId, now);
    }

    // Encontrar room da organização atual
    const orgRoom = Array.from(socket.rooms).find((room) =>
      room.startsWith("org:"),
    );

    if (!orgRoom) return;

    const organizationId = orgRoom.replace("org:", "");

    try {
      const tenantDb = await this.tenantManager.getConnection(organizationId);

      // Buscar chat para identificar participantes
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(eq(chat.id, data.chatId))
        .limit(1);

      if (!chatRecord) {
        log.warn(`Chat not found: ${data.chatId}`);
        return;
      }

      log.info({
        chatId: data.chatId,
        messageSource: chatRecord.messageSource,
        action,
      }, `Chat messageSource: ${chatRecord.messageSource}`);

      // Se WhatsApp, enviar presence via Evolution API
      // TODO: Temporariamente desabilitado
      if (chatRecord.messageSource === "whatsapp") {
        // log.info({ chatId: data.chatId }, "→ WhatsApp chat detected, sending presence to Evolution API");
        // await this.handleWhatsAppPresence(data.chatId, action, tenantDb);
        return;
      }

      // Para chats internos, não fazer nada (por enquanto)
      // Presence "available/unavailable" é principalmente para WhatsApp
      log.info({ chatId: data.chatId, messageSource: chatRecord.messageSource }, "Internal chat, skipping presence send");
    } catch (error) {
      log.error({ err: error }, `Error handling presence:${action}`);
    }
  }

  /**
   * Processa evento de digitação
   * @param socket - Socket do cliente
   * @param data - Dados do evento (chatId)
   * @param action - "start" ou "stop"
   */
  async handleTyping(
    socket: Socket,
    data: { chatId: string },
    action: "start" | "stop",
  ): Promise<void> {
    if (!data.chatId) {
      socket.emit("error", { message: "chatId is required" });
      return;
    }

    log.info(`← ${socket.id} | typing:${action} → chat:${data.chatId}`);

    const socketData = socket.data as SocketData;
    const userId = socketData.userId;

    // Encontrar room da organização atual
    const orgRoom = Array.from(socket.rooms).find((room) =>
      room.startsWith("org:"),
    );

    if (!orgRoom) return;

    const organizationId = orgRoom.replace("org:", "");

    try {
      const tenantDb = await this.tenantManager.getConnection(organizationId);

      // Buscar chat para identificar participantes
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(eq(chat.id, data.chatId))
        .limit(1);

      if (!chatRecord) {
        log.warn(`Chat not found: ${data.chatId}`);
        return;
      }

      // NOVO: Se WhatsApp, enviar presence via Evolution API
      // TODO: Temporariamente desabilitado
      if (chatRecord.messageSource === "whatsapp") {
        // await this.handleWhatsAppPresence(data.chatId, action, tenantDb);
        // Não fazer broadcast local - apenas enviar para WhatsApp
        // O typing do contato será recebido via webhook presence.update
        return;
      }

      // Determinar tipo de chat e target
      const targetInfo = await this.determineTarget(
        chatRecord,
        organizationId,
        userId,
        tenantDb,
      );

      if (!targetInfo) {
        log.warn(`No target found for chat ${data.chatId}`);
        return;
      }

      // Emitir evento para target
      const event = `typing:${action}`;
      const payload: Record<string, unknown> = {
        chatId: targetInfo.chatId,
        agentId: targetInfo.agentId ?? userId ?? "unknown",
      };

      // Adicionar agentName apenas para typing:start
      if (action === "start") {
        payload.agentName = "Agent";
      }

      this.io.to(targetInfo.room).emit(event, payload);

      log.info(`→ ${targetInfo.room} | ${event} (${targetInfo.type})`);
    } catch (error) {
      log.error({ err: error }, `Error handling typing:${action}`);
    }
  }

  /**
   * Send presence to WhatsApp via Evolution API
   */
  private async handleWhatsAppPresence(
    chatId: string,
    action: "start" | "stop" | "available" | "unavailable",
    tenantDb: TenantDB,
  ): Promise<void> {
    try {
      // 1. Buscar chat com channel e contact
      const [chatRecord] = await tenantDb
        .select({
          chat,
          channel,
          contact,
        })
        .from(chat)
        .leftJoin(channel, eq(chat.channelId, channel.id))
        .innerJoin(contact, eq(chat.contactId, contact.id))
        .where(eq(chat.id, chatId))
        .limit(1);

      if (!chatRecord?.channel || !chatRecord.contact.phoneNumber) {
        log.warn({ chatId }, "Chat missing channel or contact phone");
        return;
      }

      // 2. Chamar Evolution API
      const evolutionClient = new EvolutionAPIClient(
        env.EVOLUTION_API_URL,
        env.EVOLUTION_API_KEY,
      );

      // Map action to Evolution API presence state
      const presenceMap = {
        start: "composing",
        stop: "paused",
        available: "available",
        unavailable: "unavailable",
      } as const;

      const presence = presenceMap[action];

      // Use delay=0 for unavailable to clear immediately
      // Use 10s delay for others (composing, recording, available)
      const delay = action === "unavailable" ? 0 : 10000;

      log.info(
        {
          chatId,
          action,
          presence,
          delay,
          phoneNumber: chatRecord.contact.phoneNumber
        },
        `→ Sending presence to WhatsApp: ${presence} (delay: ${delay}ms)`,
      );

      await evolutionClient.chat.sendPresence(
        chatRecord.channel.evolutionInstanceName,
        {
          number: chatRecord.contact.phoneNumber,
          delay,
          presence,
        },
      );

      log.info(
        { chatId, presence, phoneNumber: chatRecord.contact.phoneNumber },
        "✓ Presence sent to WhatsApp",
      );
    } catch (error) {
      log.error({ chatId, error }, "Failed to send presence to WhatsApp");
    }
  }

  /**
   * Determina room e chatId de destino baseado no tipo de chat
   */
  private async determineTarget(
    chatRecord: typeof chat.$inferSelect,
    organizationId: string,
    userId: string | undefined,
    tenantDb: TenantDB,
  ): Promise<TargetInfo | null> {
    // Chat WhatsApp - broadcast para toda a org
    if (chatRecord.messageSource === "whatsapp") {
      return {
        type: "whatsapp-broadcast",
        room: `org:${organizationId}`,
        chatId: chatRecord.id,
        agentId: userId,
      };
    }

    // Chat Interno
    if (chatRecord.messageSource === "internal") {
      // Buscar contact para verificar tipo
      const [contactRecord] = await tenantDb
        .select()
        .from(contact)
        .where(eq(contact.id, chatRecord.contactId))
        .limit(1);

      if (!contactRecord) return null;

      const metadata = contactRecord.metadata as {
        targetOrganizationId?: string;
        targetOrganizationInstanceCode?: string;
        agentId?: string;
      } | null;

      // CROSS-ORG: enviar para org target
      if (metadata?.targetOrganizationId) {
        return await this.findCrossOrgTarget(
          metadata.targetOrganizationId,
          organizationId,
        );
      }

      // INTRA-ORG: enviar para agent específico
      if (chatRecord.initiatorAgentId) {
        return await this.findIntraOrgTarget(
          chatRecord,
          contactRecord,
          userId,
          tenantDb,
        );
      }
    }

    return null;
  }

  /**
   * Encontra target para chat cross-org
   */
  private async findCrossOrgTarget(
    targetOrgId: string,
    sourceOrgId: string,
  ): Promise<TargetInfo | null> {
    try {
      const targetTenantDb =
        await this.tenantManager.getConnection(targetOrgId);

      // Buscar contact mirrored na org target
      const targetContacts = await targetTenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, targetOrgId));

      const sourceContact = targetContacts.find(
        (c) =>
          (
            c.metadata as {
              source?: string;
              targetOrganizationId?: string;
            } | null
          )?.source === "internal" &&
          (c.metadata as { targetOrganizationId?: string } | null)
            ?.targetOrganizationId === sourceOrgId,
      );

      if (!sourceContact) return null;

      // Buscar chat ATIVO (não enviar typing para chat fechado)
      const [mirroredChat] = await targetTenantDb
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.messageSource, "internal"),
            eq(chat.contactId, sourceContact.id),
            or(eq(chat.status, "pending"), eq(chat.status, "open")),
          ),
        )
        .limit(1);

      if (!mirroredChat) return null;

      return {
        type: "cross-org",
        room: `org:${targetOrgId}`,
        chatId: mirroredChat.id,
        agentId: undefined,
      };
    } catch (error) {
      log.error({ err: error }, "Error finding cross-org target");
      return null;
    }
  }

  /**
   * Encontra target para chat intra-org
   */
  private async findIntraOrgTarget(
    chatRecord: typeof chat.$inferSelect,
    contactRecord: typeof contact.$inferSelect,
    userId: string | undefined,
    tenantDb: TenantDB,
  ): Promise<TargetInfo | null> {
    const [currentAgent] = await tenantDb
      .select()
      .from(agent)
      .where(eq(agent.userId, userId ?? ""))
      .limit(1);

    if (!currentAgent) return null;

    const metadata = contactRecord.metadata as { agentId?: string } | null;
    const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;
    const targetAgentId = isInitiator
      ? metadata?.agentId
      : chatRecord.initiatorAgentId;

    if (!targetAgentId) return null;

    return {
      type: "intra-org",
      room: `agent:${targetAgentId}`,
      chatId: chatRecord.id,
      agentId: currentAgent.id,
    };
  }
}

/**
 * Informações do destino do evento de digitação
 */
interface TargetInfo {
  type: "whatsapp-broadcast" | "cross-org" | "intra-org";
  room: string;
  chatId: string;
  agentId: string | undefined;
}
