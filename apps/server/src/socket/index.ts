import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import type { SocketData } from "./types";
import { env } from "../env";
import { authMiddleware, validateOrganizationAccess } from "./middleware";
import { RedisPubSubManager } from "./redis-pubsub";

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
      socket.on("join:organization", (organizationId: string) => {
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

        console.log(
          `[Socket.io] ← ${socket.id} | join:organization → ${room}`,
        );

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
