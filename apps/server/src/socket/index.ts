import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import type { SocketData } from "./types";
import { env } from "../env";
import { tenantManager } from "../libs/tenant-manager";
import { TypingHandler, OrganizationHandler } from "./handlers";
import { authMiddleware } from "./middleware";
import { RedisPubSubManager } from "./redis-pubsub";
import { createLogger } from "../libs/utils/logger";

const log = createLogger("SocketManager");

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
  private typingHandler: TypingHandler;
  private organizationHandler: OrganizationHandler;

  constructor(httpServer: HTTPServer) {
    log.info("🚀 Initializing Socket.io server...");

    // Initialize Socket.io server with CORS
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.SOCKET_IO_CORS_ORIGIN,
        credentials: true,
      },
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });
    log.info({ cors: env.SOCKET_IO_CORS_ORIGIN, path: "/socket.io" }, "Socket.io server configured");

    // Setup Socket.io connection handlers
    log.info("Setting up socket handlers...");
    this.setupSocketHandlers();
    log.info("✅ Socket handlers registered");

    // Initialize Redis Pub/Sub for receiving events
    log.info("Initializing Redis Pub/Sub manager...");
    this.redisPubSub = new RedisPubSubManager(this.io);

    // Initialize typing handler
    log.info("Initializing typing handler...");
    this.typingHandler = new TypingHandler(this.io, tenantManager);

    // Initialize organization handler
    log.info("Initializing organization handler...");
    this.organizationHandler = new OrganizationHandler(this.io, tenantManager);

    log.info("✅ SocketManager fully initialized");
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
      log.info({
        socketId: socket.id,
        userId: socketData.userId,
        userEmail: socketData.userEmail,
        transport: socket.conn.transport.name
      }, "✓ Client connected");

      /**
       * Join organization room
       * Clients must join their organization's room to receive events
       */
      socket.on("join:organization", (organizationId: string) => {
        void this.organizationHandler.handleJoin(socket, organizationId);
      });

      /**
       * Leave organization room
       */
      socket.on("leave:organization", (organizationId: string) => {
        this.organizationHandler.handleLeave(socket, organizationId);
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

        log.info({ socketId: socket.id, channelId, room }, "← join:channel");

        socket.emit("joined:channel", { room, channelId });
      });

      /**
       * Leave channel room
       */
      socket.on("leave:channel", (channelId: string) => {
        if (!channelId) return;

        const room = `channel:${channelId}`;
        void socket.leave(room);

        log.info({ socketId: socket.id, channelId, room }, "← leave:channel");
      });

      /**
       * Typing indicators - delegados para TypingHandler
       */
      socket.on("typing:start", (data: { chatId: string }) => {
        void this.typingHandler.handleTyping(socket, data, "start");
      });

      socket.on("typing:stop", (data: { chatId: string }) => {
        void this.typingHandler.handleTyping(socket, data, "stop");
      });

      /**
       * Disconnect handler
       */
      socket.on("disconnect", (reason) => {
        log.info({
          socketId: socket.id,
          userId: socketData.userId,
          reason
        }, "✗ Client disconnected");
      });

      /**
       * Debug: list rooms
       */
      socket.on("rooms", () => {
        socket.emit("rooms", Array.from(socket.rooms));
      });
    });

    log.info("✅ Socket connection handlers ready");
  }

  /**
   * Manually emit event to a room (useful for testing)
   */
  public emitToRoom(room: string, event: string, data: unknown): void {
    log.info({ room, event }, "→ Broadcasting to room");
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
    log.info("Shutting down SocketManager...");

    // Disconnect all clients
    log.info("Disconnecting all clients...");
    this.io.disconnectSockets();

    // Close Socket.io server
    await new Promise<void>((resolve) => {
      void this.io.close(() => {
        log.info("✅ Socket.io server closed");
        resolve();
      });
    });

    // Close Redis Pub/Sub
    log.info("Closing Redis Pub/Sub...");
    await this.redisPubSub.close();

    log.info("✅ SocketManager shutdown complete");
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
    throw new Error(
      "SocketManager not initialized. Call setSocketManager first.",
    );
  }
  return socketManagerInstance;
}
