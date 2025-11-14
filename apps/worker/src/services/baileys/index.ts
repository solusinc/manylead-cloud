import type { Boom } from "@hapi/boom";
import type {
  ConnectionState,
  MessageUpsertType,
  WAMessage,
  WAMessageUpdate,
  WASocket,
} from "@whiskeysockets/baileys";
import type Redis from "ioredis";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";

import { CHANNEL_LIMITS } from "@manylead/shared";

import type { DistributedSessionRegistry } from "../registry";
import { logger } from "~/libs/utils/logger";
import { useDatabaseAuthState } from "./auth-state";

/**
 * Baileys Session Manager
 *
 * Manages WhatsApp Web sessions using Baileys library.
 * Handles QR code generation, connection, and state persistence.
 *
 * Auth state is stored in the database (authState JSONB column)
 * instead of local files, allowing for scalability and persistence.
 *
 * Uses DistributedSessionRegistry for horizontal scaling across workers.
 */
export class BaileysSessionManager {
  private socket: WASocket | null = null;
  private redis: Redis;
  private registry: DistributedSessionRegistry;
  private channelId: string;
  private organizationId: string;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolve: (() => void) | null = null;
  private connectionReject: ((error: Error) => void) | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  constructor(
    channelId: string,
    organizationId: string,
    redis: Redis,
    registry: DistributedSessionRegistry,
  ) {
    this.channelId = channelId;
    this.organizationId = organizationId;
    this.redis = redis;
    this.registry = registry;
  }

  /**
   * Start WhatsApp session and generate QR code
   */
  async start(): Promise<void> {
    try {
      logger.info(
        { channelId: this.channelId },
        "[Baileys] Starting session...",
      );

      // Register session in distributed registry
      await this.registry.registerSession(this.channelId);
      logger.info(
        { channelId: this.channelId },
        "[Baileys] Session registered in registry",
      );

      // Start heartbeat to keep session alive in registry
      this.startHeartbeat();

      // Create connection promise
      this.connectionPromise = new Promise<void>((resolve, reject) => {
        this.connectionResolve = resolve;
        this.connectionReject = reject;
      });

      // Load auth state from database
      const { state, saveCreds } = await useDatabaseAuthState(
        this.channelId,
        this.organizationId,
      );

      // Fetch latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(
        { channelId: this.channelId, version: version.join("."), isLatest },
        "[Baileys] Using WhatsApp Web version",
      );

      // Create WhatsApp socket
      this.socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // getMessage callback for message history sync
        getMessage: (key) => {
          // TODO: Fetch message from database by key.id
          // For now, return undefined to use default behavior
          logger.debug(
            {
              channelId: this.channelId,
              messageId: key.id,
              remoteJid: key.remoteJid,
            },
            "[Baileys] getMessage callback triggered",
          );
          return Promise.resolve(undefined);
        },
      });

      // Handle credentials update (save auth state to DB)
      this.socket.ev.on("creds.update", () => {
        void saveCreds();
      });

      // Handle connection updates
      this.socket.ev.on("connection.update", (update) => {
        void this.handleConnectionUpdate(update);
      });

      // Handle incoming/outgoing messages
      this.socket.ev.on("messages.upsert", (m) => {
        void this.handleMessagesUpsert(m);
      });

      // Handle message updates (delivery, read receipts, etc.)
      this.socket.ev.on("messages.update", (updates) => {
        void this.handleMessagesUpdate(updates);
      });

      logger.info(
        { channelId: this.channelId },
        "[Baileys] ✅ Session started",
      );
    } catch (error) {
      logger.error(
        { channelId: this.channelId, error },
        "[Baileys] Failed to start session",
      );

      // Unregister session on failure
      await this.registry.unregisterSession(this.channelId);

      // Reject connection promise if it exists
      if (this.connectionReject) {
        this.connectionReject(error as Error);
      }

      throw error;
    }
  }

  /**
   * Handle connection status updates from Baileys
   */
  private async handleConnectionUpdate(
    update: Partial<ConnectionState>,
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = update;

    // QR code generated
    if (qr) {
      logger.info({ channelId: this.channelId }, "[Baileys] QR code generated");

      // QR expires in ~20 seconds
      const expiresAt = new Date(Date.now() + 20 * 1000).toISOString();

      // Publish QR code event to Redis
      await this.publishEvent("channel:qr-updated", {
        qrCode: qr,
        expiresAt,
        status: "pending",
      });
    }

    // Connection opened (user scanned QR)
    if (connection === "open") {
      this.isConnected = true;

      // Reset reconnect attempts on successful connection
      this.resetReconnectAttempts();

      logger.info(
        { channelId: this.channelId },
        "[Baileys] ✅ Connected successfully",
      );

      // Get phone number info
      const phoneNumber = this.socket?.user?.id.split(":")[0];

      // Publish connected event
      await this.publishEvent("channel:connected", {
        status: "connected",
        phoneNumber: phoneNumber ? `+${phoneNumber}` : undefined,
      });

      // Resolve connection promise
      if (this.connectionResolve) {
        this.connectionResolve();
        this.connectionResolve = null;
        this.connectionReject = null;
      }
    }

    // Connection closed
    if (connection === "close") {
      this.isConnected = false;

      const boomError = lastDisconnect?.error as Boom | undefined;
      const statusCode = boomError?.output.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.info(
        {
          channelId: this.channelId,
          shouldReconnect,
          reason: statusCode,
          reconnectAttempts: this.reconnectAttempts,
        },
        "[Baileys] Connection closed",
      );

      // If we were waiting for initial connection and it failed, reject the promise
      if (this.connectionReject) {
        const errorMessage =
          (lastDisconnect?.error as Error | undefined)?.message ??
          "Connection closed";
        this.connectionReject(new Error(errorMessage));
        this.connectionResolve = null;
        this.connectionReject = null;
      }

      if (shouldReconnect) {
        // Check if max reconnect attempts reached
        if (this.reconnectAttempts >= CHANNEL_LIMITS.MAX_RECONNECT_ATTEMPTS) {
          logger.error(
            { channelId: this.channelId },
            "[Baileys] Max reconnect attempts reached, giving up",
          );

          await this.publishEvent("channel:error", {
            status: "error",
            error: "Max reconnect attempts reached",
          });

          // Cleanup and unregister
          await this.stop();
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s...
        const backoffDelay = Math.min(
          1000 * 2 ** this.reconnectAttempts,
          60000,
        ); // Max 60s

        logger.info(
          {
            channelId: this.channelId,
            attempt: this.reconnectAttempts + 1,
            delayMs: backoffDelay,
          },
          "[Baileys] Reconnecting with exponential backoff...",
        );

        this.reconnectAttempts++;

        // Wait before reconnecting
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        // Reconnect automatically
        await this.start();
      } else {
        // User logged out manually
        await this.publishEvent("channel:disconnected", {
          status: "disconnected",
          error: "User logged out",
        });

        // Cleanup and unregister
        await this.stop();
      }
    }
  }

  /**
   * Handle incoming/outgoing messages
   */
  private handleMessagesUpsert(m: {
    messages: WAMessage[];
    type: MessageUpsertType;
  }): void {
    const { messages, type } = m;

    logger.info(
      {
        channelId: this.channelId,
        count: messages.length,
        type,
      },
      "[Baileys] Messages received",
    );

    // TODO: Save messages to database
    // For now, just log them
    for (const msg of messages) {
      logger.debug(
        {
          channelId: this.channelId,
          messageId: msg.key.id,
          from: msg.key.remoteJid,
          fromMe: msg.key.fromMe,
          timestamp: msg.messageTimestamp,
        },
        "[Baileys] Message details",
      );
    }
  }

  /**
   * Handle message updates (delivery receipts, read receipts, reactions, etc.)
   */
  private handleMessagesUpdate(updates: WAMessageUpdate[]): void {
    logger.debug(
      {
        channelId: this.channelId,
        count: updates.length,
      },
      "[Baileys] Message updates received",
    );

    // TODO: Update messages in database
    // For now, just log them
    for (const update of updates) {
      logger.debug(
        {
          channelId: this.channelId,
          messageId: update.key.id,
          status: update.update.status,
        },
        "[Baileys] Message update details",
      );
    }
  }

  /**
   * Publish event to Redis for Socket.io broadcasting
   */
  private async publishEvent(
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const event = {
      type,
      organizationId: this.organizationId,
      channelId: this.channelId,
      data,
    };

    await this.redis.publish("channels:events", JSON.stringify(event));

    logger.info(
      {
        type,
        channelId: this.channelId,
      },
      "[Baileys] Event published to Redis",
    );
  }

  /**
   * Stop session and cleanup
   */
  async stop(): Promise<void> {
    logger.info({ channelId: this.channelId }, "[Baileys] Stopping session");

    // Stop heartbeat
    this.stopHeartbeat();

    // Logout from WhatsApp if socket exists
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (error) {
        logger.warn(
          { channelId: this.channelId, error },
          "[Baileys] Error during logout (ignoring)",
        );
      }

      this.socket = null;
    }

    this.isConnected = false;

    // Unregister from distributed registry
    await this.registry.unregisterSession(this.channelId);

    logger.info({ channelId: this.channelId }, "[Baileys] ✅ Session stopped");
  }

  /**
   * Start heartbeat to keep session alive in registry
   */
  private startHeartbeat(): void {
    // Clear existing interval if any
    this.stopHeartbeat();

    // Update heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      void (async () => {
        try {
          await this.registry.updateHeartbeat(this.channelId);
          logger.debug(
            { channelId: this.channelId },
            "[Baileys] Heartbeat updated",
          );
        } catch (error) {
          logger.error(
            { channelId: this.channelId, error },
            "[Baileys] Failed to update heartbeat",
          );
        }
      })();
    }, CHANNEL_LIMITS.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reset reconnect attempts counter (called on successful connection)
   */
  private resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  /**
   * Check if session is connected
   */
  isSessionConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Wait for connection to be established
   * Resolves immediately if already connected
   */
  async waitForConnection(timeoutMs = 30000): Promise<void> {
    // Already connected
    if (this.isConnected) {
      return;
    }

    // No connection promise exists
    if (!this.connectionPromise) {
      throw new Error("Session not started");
    }

    // Wait for connection with timeout
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    await Promise.race([this.connectionPromise, timeoutPromise]);
  }

  /**
   * Get socket instance (for sending messages)
   */
  getSocket(): WASocket | null {
    return this.socket;
  }

  /**
   * Send a text message to a phone number
   */
  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("WhatsApp não está conectado");
    }

    // Format phone number for WhatsApp
    // Remove all non-digit characters and add @s.whatsapp.net
    const phoneNumber = to.replace(/\D/g, "");
    const jid = `${phoneNumber}@s.whatsapp.net`;

    logger.info(
      { channelId: this.channelId, to: jid },
      "[Baileys] Sending message",
    );

    await this.socket.sendMessage(jid, { text });

    logger.info(
      { channelId: this.channelId, to: jid },
      "[Baileys] ✅ Message sent",
    );
  }
}
