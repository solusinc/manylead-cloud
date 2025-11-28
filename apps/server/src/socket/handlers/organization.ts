import type { Server as SocketIOServer, Socket } from "socket.io";
import type { TenantDatabaseManager } from "@manylead/tenant-db";
import { agent, eq } from "@manylead/db";
import type { SocketData } from "../types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("OrganizationHandler");

/**
 * Handler para eventos de organização (join/leave)
 * Gerencia entrada e saída de usuários em rooms de organizações
 */
export class OrganizationHandler {
  constructor(
    private io: SocketIOServer,
    private tenantManager: TenantDatabaseManager,
  ) {}

  /**
   * Processa evento de join em organização
   *
   * Responsabilidades:
   * - Validar organizationId
   * - Validar acesso do usuário à org
   * - Join no room org:${organizationId}
   * - Buscar agent do usuário
   * - Join no room agent:${agentId} se existir
   */
  async handleJoin(socket: Socket, organizationId: string): Promise<void> {
    const socketData = socket.data as SocketData;

    log.info({ socketId: socket.id, organizationId }, "← join:organization request");

    if (!organizationId) {
      log.warn({ socketId: socket.id }, "join:organization missing organizationId");
      socket.emit("error", { message: "organizationId is required" });
      return;
    }

    // Validate user has access to this organization
    if (!this.validateOrganizationAccess(socket, organizationId)) {
      log.warn({
        socketId: socket.id,
        userId: socketData.userId,
        organizationId
      }, "❌ Unauthorized access attempt");
      socket.emit("error", {
        message: "Unauthorized access to organization",
      });
      return;
    }

    const room = `org:${organizationId}`;
    void socket.join(room);
    log.info({ socketId: socket.id, room }, "Joined organization room");

    // Buscar agentId e fazer join no room do agent
    try {
      const tenant =
        await this.tenantManager.getTenantByOrganization(organizationId);

      if (!tenant) {
        log.warn({ socketId: socket.id, organizationId }, "Tenant not found");
        socket.emit("joined", { room, organizationId });
        return;
      }

      if (tenant.status !== "active") {
        log.info({
          socketId: socket.id,
          organizationId,
          tenantStatus: tenant.status
        }, "Tenant not active, provisioning mode");
        socket.emit("joined", { room, organizationId, provisioning: true });
        return;
      }

      const tenantDb = await this.tenantManager.getConnection(organizationId);
      const [userAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, socketData.userId ?? ""))
        .limit(1);

      if (userAgent) {
        // Join no room do agent (para eventos personalizados)
        const agentRoom = `agent:${userAgent.id}`;
        void socket.join(agentRoom);

        // Armazenar agentId no socket data
        socketData.agentIds ??= new Map();
        socketData.agentIds.set(organizationId, userAgent.id);

        log.info({
          socketId: socket.id,
          organizationId,
          agentId: userAgent.id,
          rooms: [room, agentRoom]
        }, "✅ Joined organization + agent rooms");
      } else {
        log.info({ socketId: socket.id, room }, "✅ Joined organization room (no agent)");
      }
    } catch (error) {
      log.error({ err: error, socketId: socket.id }, "Error fetching agent");
      log.info({ socketId: socket.id, room }, "Joined organization room (error)");
    }

    socket.emit("joined", { room, organizationId });
  }

  /**
   * Processa evento de leave da organização
   */
  handleLeave(socket: Socket, organizationId: string): void {
    if (!organizationId) return;

    const room = `org:${organizationId}`;
    void socket.leave(room);

    log.info({ socketId: socket.id, room }, "← leave:organization");
  }

  /**
   * Valida se usuário tem acesso à organização
   */
  private validateOrganizationAccess(socket: Socket, organizationId: string): boolean {
    const socketData = socket.data as SocketData;
    return socketData.organizationIds?.includes(organizationId) ?? false;
  }
}
