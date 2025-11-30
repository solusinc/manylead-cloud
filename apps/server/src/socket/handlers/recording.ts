import type { Server as SocketIOServer, Socket } from "socket.io";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import type { TenantDB } from "@manylead/db";
import { chat, contact, agent, eq, and, or } from "@manylead/db";
import type { SocketData } from "../types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("RecordingHandler");

/**
 * Handler para eventos de gravação (recording indicators)
 * Unifica lógica de recording:start e recording:stop
 */
export class RecordingHandler {
  constructor(
    private io: SocketIOServer,
    private tenantManager: TenantDatabaseManager,
  ) {}

  /**
   * Processa evento de gravação
   * @param socket - Socket do cliente
   * @param data - Dados do evento (chatId)
   * @param action - "start" ou "stop"
   */
  async handleRecording(
    socket: Socket,
    data: { chatId: string },
    action: "start" | "stop",
  ): Promise<void> {
    if (!data.chatId) {
      socket.emit("error", { message: "chatId is required" });
      return;
    }

    log.info(`← ${socket.id} | recording:${action} → chat:${data.chatId}`);

    const socketData = socket.data as SocketData;
    const userId = socketData.userId;

    // Encontrar room da organização atual
    const orgRoom = Array.from(socket.rooms).find((room) => room.startsWith("org:"));

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
      const event = `recording:${action}`;
      const payload: Record<string, unknown> = {
        chatId: targetInfo.chatId,
        agentId: targetInfo.agentId ?? userId ?? "unknown",
      };

      // Adicionar agentName apenas para recording:start
      if (action === "start") {
        payload.agentName = "Agent";
      }

      this.io.to(targetInfo.room).emit(event, payload);

      log.info(`→ ${targetInfo.room} | ${event} (${targetInfo.type})`);
    } catch (error) {
      log.error({ err: error }, `Error handling recording:${action}`);
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
      const targetTenantDb = await this.tenantManager.getConnection(targetOrgId);

      // Buscar contact mirrored na org target
      const targetContacts = await targetTenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, targetOrgId));

      const sourceContact = targetContacts.find(
        (c) =>
          (c.metadata as { source?: string; targetOrganizationId?: string } | null)
            ?.source === "internal" &&
          (c.metadata as { targetOrganizationId?: string } | null)
            ?.targetOrganizationId === sourceOrgId,
      );

      if (!sourceContact) return null;

      // Buscar chat ATIVO (não enviar recording para chat fechado)
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
 * Informações do destino do evento de gravação
 */
interface TargetInfo {
  type: "whatsapp-broadcast" | "cross-org" | "intra-org";
  room: string;
  chatId: string;
  agentId: string | undefined;
}
