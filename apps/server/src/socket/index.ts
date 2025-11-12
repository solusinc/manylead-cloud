import { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import Redis from "ioredis";
import { env } from "../env";

/**
 * Event types emitted to Socket.io clients
 */
export interface ProvisioningEvent {
  type: "provisioning:progress" | "provisioning:complete" | "provisioning:error";
  organizationId: string;
  data: {
    progress?: number;
    currentStep?: string;
    message?: string;
    error?: string;
  };
}

/**
 * Socket.io server setup with Redis Pub/Sub integration
 *
 * Architecture:
 * 1. Worker processes tenant provisioning jobs
 * 2. Worker publishes progress events to Redis channel "tenant:provisioning"
 * 3. Server subscribes to Redis channel
 * 4. Server broadcasts events to Socket.io clients in the organization's room
 * 5. Dashboard UI listens for real-time updates
 */
export class SocketManager {
  private io: SocketIOServer;
  private redisSubscriber: Redis;

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

    // Initialize Redis subscriber for Pub/Sub
    // PERFORMANCE OPTIMIZATION: enableAutoPipelining batches commands automatically
    this.redisSubscriber = new Redis(env.REDIS_URL, {
      lazyConnect: false, // Connect immediately
      enableAutoPipelining: true, // Batch commands for low latency
      keepAlive: 30000, // Keep TCP connection alive
      connectTimeout: 10000, // 10 second timeout
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`[Socket.io] Retrying Redis connection in ${delay}ms...`);
        return delay;
      },
    });

    this.setupSocketHandlers();
    this.setupRedisPubSub();
  }

  /**
   * Setup Socket.io connection handlers
   */
  private setupSocketHandlers(): void {
    this.io.on("connection", (socket) => {
      console.log(`[Socket.io] Client connected: ${socket.id}`);

      // Join organization room
      socket.on("join:organization", (organizationId: string) => {
        if (!organizationId) {
          socket.emit("error", { message: "organizationId is required" });
          return;
        }

        const room = `org:${organizationId}`;
        socket.join(room);
        console.log(
          `[Socket.io] Client ${socket.id} joined room: ${room}`,
        );

        socket.emit("joined", { room, organizationId });
      });

      // Leave organization room
      socket.on("leave:organization", (organizationId: string) => {
        if (!organizationId) return;

        const room = `org:${organizationId}`;
        socket.leave(room);
        console.log(
          `[Socket.io] Client ${socket.id} left room: ${room}`,
        );
      });

      socket.on("disconnect", () => {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      });

      // Debug: list rooms
      socket.on("rooms", () => {
        socket.emit("rooms", Array.from(socket.rooms));
      });
    });

    console.log("[Socket.io] ✅ Socket handlers initialized");
  }

  /**
   * Setup Redis Pub/Sub for receiving provisioning events from worker
   */
  private async setupRedisPubSub(): Promise<void> {
    try {
      // IMPORTANT: Register message handlers BEFORE subscribing
      // Handle messages from Redis
      this.redisSubscriber.on("message", (channel, message) => {
        console.log(`[Socket.io] Received message on channel: ${channel}`);
        if (channel === "tenant:provisioning") {
          this.handleProvisioningEvent(message);
        }
      });

      // Handle reconnection - resubscribe when reconnected
      this.redisSubscriber.on("ready", async () => {
        console.log("[Socket.io] Redis connection ready/reconnected");
        // Resubscribe after reconnection
        try {
          await this.redisSubscriber.subscribe("tenant:provisioning");
          console.log("[Socket.io] ✅ Re-subscribed to Redis channel after reconnection");
        } catch (err) {
          console.error("[Socket.io] Failed to resubscribe:", err);
        }
      });

      this.redisSubscriber.on("reconnecting", () => {
        console.log("[Socket.io] Redis reconnecting...");
      });

      this.redisSubscriber.on("error", (error) => {
        console.error("[Socket.io] Redis subscriber error:", error);
      });

      this.redisSubscriber.on("close", () => {
        console.log("[Socket.io] Redis connection closed");
      });

      // With lazyConnect: false, connection happens automatically
      // Wait for the connection to be ready before subscribing
      if (this.redisSubscriber.status !== "ready") {
        await new Promise<void>((resolve) => {
          this.redisSubscriber.once("ready", () => {
            console.log("[Socket.io] Redis connection ready");
            resolve();
          });
        });
      }

      // Subscribe to tenant provisioning events
      await this.redisSubscriber.subscribe("tenant:provisioning");

      console.log(
        "[Socket.io] ✅ Subscribed to Redis channel: tenant:provisioning",
      );
      console.log(`[Socket.io] Subscriber status: ${this.redisSubscriber.status}`);
    } catch (error) {
      console.error("[Socket.io] Failed to setup Redis Pub/Sub:", error);
      throw error;
    }
  }

  /**
   * Handle provisioning events from Redis and broadcast to clients
   */
  private handleProvisioningEvent(message: string): void {
    try {
      const event = JSON.parse(message) as ProvisioningEvent;
      const room = `org:${event.organizationId}`;

      console.log(
        `[Socket.io] Broadcasting ${event.type} to room: ${room}`,
      );

      // Broadcast to all clients in the organization's room
      this.io.to(room).emit(event.type, event.data);
    } catch (error) {
      console.error(
        "[Socket.io] Failed to parse provisioning event:",
        error,
      );
    }
  }

  /**
   * Manually emit event to a room (useful for testing)
   */
  public emitToRoom(room: string, event: string, data: unknown): void {
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
    console.log("[Socket.io] Closing connections...");

    // Disconnect all clients
    this.io.disconnectSockets();

    // Close Socket.io server
    await new Promise<void>((resolve) => {
      this.io.close(() => {
        console.log("[Socket.io] ✅ Socket.io server closed");
        resolve();
      });
    });

    // Disconnect Redis subscriber
    await this.redisSubscriber.quit();
    console.log("[Socket.io] ✅ Redis subscriber closed");
  }
}
