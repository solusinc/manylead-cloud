import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import type { SocketData } from "./types";
import { env } from "../env";
import { authMiddleware, validateOrganizationAccess } from "./middleware";
import { RedisPubSubManager } from "./redis-pubsub";
import { agent, chat, contact, eq } from "@manylead/db";
import { tenantManager } from "../libs/tenant-manager";

/**
 * Socket.io Manager
 *
 * Manages Socket.io connections, rooms, and real-time events.
 * Uses Redis Pub/Sub to receive events from workers and broadcast to clients.
 *
 * Architecture:
 * 1. Worker processes jobs (provisioning, channels, etc.)
 * 2. Worker publishes events to Redis channels
 * 3. RedisPubSubManager subscribes and routes to handlers
 * 4. Handlers broadcast events to Socket.io clients in organization rooms
 * 5. Dashboard UI receives real-time updates
 */
export class SocketManager {
  private io: SocketIOServer;
  private redisPubSub: RedisPubSubManager;

  constructor(httpServer: HTTPServer) {
    // Initialize Socket.io server with CORS
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.SOCKET_IO_CORS_ORIGIN,
        credentials: true,
      },
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    // Setup Socket.io connection handlers
    this.setupSocketHandlers();

    // Initialize Redis Pub/Sub for receiving events
    this.redisPubSub = new RedisPubSubManager(this.io);

    console.log("[SocketManager] ✅ Initialized");
  }

  /**
   * Setup Socket.io connection handlers
   */
  private setupSocketHandlers(): void {
    // Apply authentication middleware to all connections
    this.io.use((socket, next) => {
      void authMiddleware(socket, next);
    });

    this.io.on("connection", (socket) => {
      const socketData = socket.data as SocketData;
      console.log(`[Socket.io] ✓ Connected: ${socket.id}`);

      /**
       * Join organization room
       * Clients must join their organization's room to receive events
       */
      socket.on("join:organization", async (organizationId: string) => {
        if (!organizationId) {
          socket.emit("error", { message: "organizationId is required" });
          return;
        }

        // Validate user has access to this organization
        if (!validateOrganizationAccess(socket, organizationId)) {
          socket.emit("error", {
            message: "Unauthorized access to organization",
          });
          console.warn(
            `[SocketManager] User ${socketData.userId ?? "unknown"} tried to access org ${organizationId} without permission`,
          );
          return;
        }

        const room = `org:${organizationId}`;
        void socket.join(room);

        // Buscar agentId e fazer join no room do agent
        try {
          const tenant = await tenantManager.getTenantByOrganization(organizationId);

          if (!tenant) {
            console.log(
              `[Socket.io] ← ${socket.id} | joined → ${room} (tenant not found)`,
            );
            socket.emit("joined", { room, organizationId });
            return;
          }

          if (tenant.status !== "active") {
            console.log(
              `[Socket.io] ← ${socket.id} | joined → ${room} (tenant not active: ${tenant.status})`,
            );
            socket.emit("joined", { room, organizationId, provisioning: true });
            return;
          }

          const tenantDb = await tenantManager.getConnection(organizationId);
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

            console.log(
              `[Socket.io] ← ${socket.id} | joined → ${room}, ${agentRoom}`,
            );
          } else {
            console.log(
              `[Socket.io] ← ${socket.id} | joined → ${room} (no agent)`,
            );
          }
        } catch (error) {
          console.error(`[Socket] Error fetching agent:`, error);
          console.log(
            `[Socket.io] ← ${socket.id} | joined → ${room}`,
          );
        }

        socket.emit("joined", { room, organizationId });
      });

      /**
       * Leave organization room
       */
      socket.on("leave:organization", (organizationId: string) => {
        if (!organizationId) return;

        const room = `org:${organizationId}`;
        void socket.leave(room);

        console.log(`[Socket.io] ← ${socket.id} | leave:organization → ${room}`);
      });

      /**
       * Join channel room (for QR code updates)
       * Used when user is on the channel creation page
       */
      socket.on("join:channel", (channelId: string) => {
        if (!channelId) {
          socket.emit("error", { message: "channelId is required" });
          return;
        }

        const room = `channel:${channelId}`;
        void socket.join(room);

        console.log(`[Socket.io] ← ${socket.id} | join:channel → ${room}`);

        socket.emit("joined:channel", { room, channelId });
      });

      /**
       * Leave channel room
       */
      socket.on("leave:channel", (channelId: string) => {
        if (!channelId) return;

        const room = `channel:${channelId}`;
        void socket.leave(room);

        console.log(`[Socket.io] ← ${socket.id} | leave:channel → ${room}`);
      });

      /**
       * Typing indicators - send only to chat participants
       */
      socket.on("typing:start", async (data: { chatId: string }) => {
        if (!data.chatId) {
          socket.emit("error", { message: "chatId is required" });
          return;
        }

        console.log(`[Socket.io] ← ${socket.id} | typing:start → chat:${data.chatId}`);

        const userId = socketData.userId;
        const orgRoom = Array.from(socket.rooms).find((room) => room.startsWith("org:"));

        if (!orgRoom) return;

        const organizationId = orgRoom.replace("org:", "");

        try {
          const tenantDb = await tenantManager.getConnection(organizationId);

          // Buscar chat para identificar participantes
          const [chatRecord] = await tenantDb
            .select()
            .from(chat)
            .where(eq(chat.id, data.chatId))
            .limit(1);

          if (!chatRecord) {
            console.warn(`[Socket] Chat not found: ${data.chatId}`);
            return;
          }

          // Se for chat interno, enviar apenas para o outro participante
          if (chatRecord.messageSource === "internal" && chatRecord.initiatorAgentId) {
            // Buscar agent do usuário atual
            const [currentAgent] = await tenantDb
              .select()
              .from(agent)
              .where(eq(agent.userId, userId ?? ""))
              .limit(1);

            if (!currentAgent) {
              console.warn(`[Socket] Agent not found for user: ${userId}`);
              return;
            }

            // Identificar o outro participante
            const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;
            const targetAgentId = isInitiator
              ? (await tenantDb
                  .select()
                  .from(contact)
                  .where(eq(contact.id, chatRecord.contactId))
                  .limit(1)
                  .then((rows) => {
                    const metadata = rows[0]?.metadata as { agentId?: string } | null;
                    return metadata?.agentId;
                  }))
              : chatRecord.initiatorAgentId;

            if (targetAgentId) {
              // Enviar APENAS para o agent room do outro participante
              const targetRoom = `agent:${targetAgentId}`;
              this.io.to(targetRoom).emit("typing:start", {
                chatId: data.chatId,
                agentId: currentAgent.id,
                agentName: "Agent",
              });
              console.log(`[Socket.io] → ${targetRoom} | typing:start (private)`);
            }
          } else {
            // Chat WhatsApp - broadcast para toda a org
            socket.to(orgRoom).emit("typing:start", {
              chatId: data.chatId,
              agentId: userId ?? "unknown",
              agentName: "Agent",
            });
            console.log(`[Socket.io] → ${orgRoom} | typing:start (broadcast)`);
          }
        } catch (error) {
          console.error("[Socket] Error handling typing:start:", error);
        }
      });

      socket.on("typing:stop", async (data: { chatId: string }) => {
        if (!data.chatId) {
          socket.emit("error", { message: "chatId is required" });
          return;
        }

        console.log(`[Socket.io] ← ${socket.id} | typing:stop → chat:${data.chatId}`);

        const userId = socketData.userId;
        const orgRoom = Array.from(socket.rooms).find((room) => room.startsWith("org:"));

        if (!orgRoom) return;

        const organizationId = orgRoom.replace("org:", "");

        try {
          const tenantDb = await tenantManager.getConnection(organizationId);

          // Buscar chat para identificar participantes
          const [chatRecord] = await tenantDb
            .select()
            .from(chat)
            .where(eq(chat.id, data.chatId))
            .limit(1);

          if (!chatRecord) {
            console.warn(`[Socket] Chat not found: ${data.chatId}`);
            return;
          }

          // Se for chat interno, enviar apenas para o outro participante
          if (chatRecord.messageSource === "internal" && chatRecord.initiatorAgentId) {
            // Buscar agent do usuário atual
            const [currentAgent] = await tenantDb
              .select()
              .from(agent)
              .where(eq(agent.userId, userId ?? ""))
              .limit(1);

            if (!currentAgent) {
              console.warn(`[Socket] Agent not found for user: ${userId}`);
              return;
            }

            // Identificar o outro participante
            const isInitiator = currentAgent.id === chatRecord.initiatorAgentId;
            const targetAgentId = isInitiator
              ? (await tenantDb
                  .select()
                  .from(contact)
                  .where(eq(contact.id, chatRecord.contactId))
                  .limit(1)
                  .then((rows) => {
                    const metadata = rows[0]?.metadata as { agentId?: string } | null;
                    return metadata?.agentId;
                  }))
              : chatRecord.initiatorAgentId;

            if (targetAgentId) {
              // Enviar APENAS para o agent room do outro participante
              const targetRoom = `agent:${targetAgentId}`;
              this.io.to(targetRoom).emit("typing:stop", {
                chatId: data.chatId,
                agentId: currentAgent.id,
              });
              console.log(`[Socket.io] → ${targetRoom} | typing:stop (private)`);
            }
          } else {
            // Chat WhatsApp - broadcast para toda a org
            socket.to(orgRoom).emit("typing:stop", {
              chatId: data.chatId,
              agentId: userId ?? "unknown",
            });
            console.log(`[Socket.io] → ${orgRoom} | typing:stop (broadcast)`);
          }
        } catch (error) {
          console.error("[Socket] Error handling typing:stop:", error);
        }
      });

      /**
       * Disconnect handler
       */
      socket.on("disconnect", () => {
        console.log(`[Socket.io] ✗ Disconnected: ${socket.id}`);
      });

      /**
       * Debug: list rooms
       */
      socket.on("rooms", () => {
        socket.emit("rooms", Array.from(socket.rooms));
      });
    });

    console.log("[SocketManager] ✅ Socket handlers initialized");
  }

  /**
   * Manually emit event to a room (useful for testing)
   */
  public emitToRoom(room: string, event: string, data: unknown): void {
    console.log(`[Socket.io] → ${room} | ${event}`);
    this.io.to(room).emit(event, data);
  }

  /**
   * Get Socket.io server instance
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Cleanup on shutdown
   */
  public async close(): Promise<void> {
    console.log("[SocketManager] Closing connections...");

    // Disconnect all clients
    this.io.disconnectSockets();

    // Close Socket.io server
    await new Promise<void>((resolve) => {
      void this.io.close(() => {
        console.log("[SocketManager] ✅ Socket.io server closed");
        resolve();
      });
    });

    // Close Redis Pub/Sub
    await this.redisPubSub.close();

    console.log("[SocketManager] ✅ Shutdown complete");
  }
}

// Re-export types for convenience
export * from "./types";

/**
 * Singleton instance (set by server on startup)
 */
let socketManagerInstance: SocketManager | null = null;

export function setSocketManager(instance: SocketManager): void {
  socketManagerInstance = instance;
}

export function getSocketManager(): SocketManager {
  if (!socketManagerInstance) {
    throw new Error("SocketManager not initialized. Call setSocketManager first.");
  }
  return socketManagerInstance;
}
