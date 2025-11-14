import { randomUUID } from "node:crypto";
import type { Job } from "bullmq";
import { Worker } from "bullmq";
import { CHANNEL_STATUS, channel, db, eq, organization } from "@manylead/db";
import { TenantDatabaseManager } from "@manylead/tenant-db";

import { getRedisClient } from "~/libs/cache/redis";
import { logger } from "~/libs/utils/logger";
import { BaileysSessionManager } from "~/services/baileys";
import { DistributedSessionRegistry } from "~/services/registry";

/**
 * Job data for channel session management
 */
interface ChannelSessionJob {
  action: "start" | "stop" | "sendMessage";
  channelId: string;
  organizationId: string;
  message?: {
    to: string;
    text: string;
  };
}

/**
 * In-memory store of active Baileys sessions
 * Key: channelId, Value: BaileysSessionManager instance
 */
const activeSessions = new Map<string, BaileysSessionManager>();

/**
 * Redis connection for pub/sub
 */
const redis = getRedisClient();

/**
 * Unique worker ID for distributed session registry
 */
const WORKER_ID = `worker-${randomUUID().slice(0, 8)}`;

/**
 * Distributed Session Registry for horizontal scaling
 */
const sessionRegistry = new DistributedSessionRegistry(redis, WORKER_ID);

/**
 * Channel Sessions Worker
 *
 * Manages WhatsApp Baileys sessions lifecycle:
 * - Start session → Generate QR code → Connect
 * - Stop session → Cleanup resources
 */
export function createChannelSessionsWorker(): Worker {
  return new Worker<ChannelSessionJob>(
    "channel-sessions",
    async (job: Job<ChannelSessionJob>) => {
      const { action, channelId, organizationId } = job.data;

      logger.info(
        {
          action,
          channelId,
          organizationId,
          jobId: job.id,
        },
        "[ChannelSessions] Processing job"
      );

      try {
        if (action === "start") {
          await handleStartSession(channelId, organizationId);
        } else if (action === "stop") {
          await handleStopSession(channelId);
        } else {
          // action === "sendMessage"
          if (!job.data.message) {
            throw new Error("Message data is required for sendMessage action");
          }
          await handleSendMessage(channelId, organizationId, job.data.message);
        }

        logger.info(
          {
            action,
            channelId,
            jobId: job.id,
          },
          "[ChannelSessions] ✅ Job completed"
        );

        return { success: true, channelId, action };
      } catch (error) {
        logger.error(
          {
            action,
            channelId,
            jobId: job.id,
            error,
          },
          "[ChannelSessions] ❌ Job failed"
        );
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5, // Handle 5 sessions simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // per second
      },
    }
  );
}

/**
 * Start a Baileys session
 */
async function handleStartSession(
  channelId: string,
  organizationId: string,
): Promise<void> {
  // Acquire distributed lock to prevent race conditions
  const lockAcquired = await sessionRegistry.acquireLock(channelId);

  if (!lockAcquired) {
    logger.warn(
      { channelId, workerId: WORKER_ID },
      "[ChannelSessions] Could not acquire lock, another worker is starting this session"
    );
    return;
  }

  try {
    // Check if another worker already owns this session
    const existingWorker = await sessionRegistry.getSessionWorker(channelId);

    if (existingWorker && existingWorker !== WORKER_ID) {
      logger.warn(
        { channelId, existingWorker, currentWorker: WORKER_ID },
        "[ChannelSessions] Session already owned by another worker"
      );
      return;
    }

    // Check if session already exists in this worker
    const existingSession = activeSessions.get(channelId);
    if (existingSession) {
      logger.warn(
        { channelId },
        "[ChannelSessions] Session already active, restarting..."
      );

      await existingSession.stop();
      activeSessions.delete(channelId);
    }

    // Create new session with registry
    const session = new BaileysSessionManager(
      channelId,
      organizationId,
      redis,
      sessionRegistry,
    );

    // Start session (will generate QR and emit events)
    await session.start();

    // Store in active sessions
    activeSessions.set(channelId, session);

    logger.info(
      {
        channelId,
        workerId: WORKER_ID,
        activeSessionsCount: activeSessions.size,
      },
      "[ChannelSessions] Session started"
    );
  } finally {
    // Always release the lock
    await sessionRegistry.releaseLock(channelId);
  }
}

/**
 * Stop a Baileys session
 */
async function handleStopSession(channelId: string): Promise<void> {
  const session = activeSessions.get(channelId);

  if (!session) {
    logger.warn(
      { channelId },
      "[ChannelSessions] Session not found, nothing to stop"
    );
    return;
  }

  // Stop session
  await session.stop();

  // Remove from active sessions
  activeSessions.delete(channelId);

  logger.info(
    {
      channelId,
      activeSessionsCount: activeSessions.size,
    },
    "[ChannelSessions] Session stopped"
  );
}

/**
 * Send a message through an active session
 */
async function handleSendMessage(
  channelId: string,
  organizationId: string,
  message: { to: string; text: string }
): Promise<void> {
  // Get or restore session from database
  const session = await getOrCreateSession(channelId, organizationId);

  if (!session.isSessionConnected()) {
    throw new Error(`Canal ${channelId} não está conectado ao WhatsApp.`);
  }

  // Send message
  await session.sendMessage(message.to, message.text);

  logger.info(
    {
      channelId,
      to: message.to,
    },
    "[ChannelSessions] Message sent"
  );
}

/**
 * Restore active sessions on worker startup
 * Reconnects all channels that are marked as "connected" in the database
 */
export async function restoreActiveSessions(): Promise<void> {
  logger.info(
    { workerId: WORKER_ID },
    "[ChannelSessions] Restoring active sessions..."
  );

  const tenantManager = new TenantDatabaseManager();
  let totalRestored = 0;

  try {
    // 1. Query all organizations from catalog DB
    const organizations = await db.select().from(organization);

    logger.info(
      { count: organizations.length, workerId: WORKER_ID },
      "[ChannelSessions] Found organizations"
    );

    // 2. For each organization, query connected channels
    for (const org of organizations) {
      try {
        const tenantDb = await tenantManager.getConnection(org.id);

        // Query channels with status 'connected'
        const connectedChannels = await tenantDb
          .select()
          .from(channel)
          .where(eq(channel.status, CHANNEL_STATUS.CONNECTED));

        if (connectedChannels.length === 0) {
          continue;
        }

        logger.info(
          {
            organizationId: org.id,
            organizationName: org.name,
            channelCount: connectedChannels.length,
            workerId: WORKER_ID,
          },
          "[ChannelSessions] Found connected channels"
        );

        // 3. Start session for each connected channel
        for (const ch of connectedChannels) {
          try {
            // Check if session already active in this worker
            if (activeSessions.has(ch.id)) {
              logger.debug(
                { channelId: ch.id, workerId: WORKER_ID },
                "[ChannelSessions] Session already active, skipping"
              );
              continue;
            }

            // Acquire distributed lock
            const lockAcquired = await sessionRegistry.acquireLock(ch.id);
            if (!lockAcquired) {
              logger.debug(
                { channelId: ch.id, workerId: WORKER_ID },
                "[ChannelSessions] Could not acquire lock, another worker may own this session"
              );
              continue;
            }

            try {
              // Check if another worker already owns this session
              const existingWorker = await sessionRegistry.getSessionWorker(
                ch.id
              );
              if (existingWorker && existingWorker !== WORKER_ID) {
                logger.debug(
                  {
                    channelId: ch.id,
                    existingWorker,
                    currentWorker: WORKER_ID,
                  },
                  "[ChannelSessions] Session owned by another worker"
                );
                continue;
              }

              // Start Baileys session
              const session = new BaileysSessionManager(
                ch.id,
                org.id,
                redis,
                sessionRegistry
              );

              await session.start();
              activeSessions.set(ch.id, session);
              totalRestored++;

              logger.info(
                {
                  channelId: ch.id,
                  organizationId: org.id,
                  phoneNumber: ch.phoneNumber,
                  workerId: WORKER_ID,
                },
                "[ChannelSessions] ✅ Session restored"
              );
            } finally {
              await sessionRegistry.releaseLock(ch.id);
            }
          } catch (error) {
            logger.error(
              {
                channelId: ch.id,
                organizationId: org.id,
                error,
                workerId: WORKER_ID,
              },
              "[ChannelSessions] Failed to restore channel session"
            );
          }
        }
      } catch (error) {
        logger.error(
          {
            organizationId: org.id,
            organizationName: org.name,
            error,
            workerId: WORKER_ID,
          },
          "[ChannelSessions] Failed to process organization"
        );
      }
    }

    logger.info(
      {
        totalRestored,
        totalOrganizations: organizations.length,
        workerId: WORKER_ID,
      },
      "[ChannelSessions] ✅ Session restoration complete"
    );
  } catch (error) {
    logger.error(
      { error, workerId: WORKER_ID },
      "[ChannelSessions] Failed to restore active sessions"
    );
  }
}

/**
 * Get active session or create it if channel is connected
 */
export async function getOrCreateSession(
  channelId: string,
  organizationId: string
): Promise<BaileysSessionManager> {
  // Check if session already exists in memory
  let session = activeSessions.get(channelId);

  if (session) {
    return session;
  }

  // Session not in memory, check if channel is connected in DB
  const tenantManager = new TenantDatabaseManager();
  const tenantDb = await tenantManager.getConnection(organizationId);

  const [ch] = await tenantDb
    .select()
    .from(channel)
    .where(eq(channel.id, channelId))
    .limit(1);

  if (!ch) {
    throw new Error(`Canal ${channelId} não encontrado`);
  }

  if (ch.status !== CHANNEL_STATUS.CONNECTED) {
    throw new Error(
      `Canal ${channelId} não está conectado. Status atual: ${ch.status}`
    );
  }

  // Channel is connected in DB but session not in memory - restore it
  logger.info(
    { channelId, organizationId },
    "[ChannelSessions] Restoring session from database state..."
  );

  session = new BaileysSessionManager(
    channelId,
    organizationId,
    redis,
    sessionRegistry,
  );
  await session.start();

  // Wait for connection to be established before proceeding
  logger.info(
    { channelId },
    "[ChannelSessions] Waiting for WhatsApp connection..."
  );
  await session.waitForConnection();

  activeSessions.set(channelId, session);

  logger.info(
    {
      channelId,
      workerId: WORKER_ID,
      activeSessionsCount: activeSessions.size,
    },
    "[ChannelSessions] ✅ Session restored and connected"
  );

  return session;
}

/**
 * Cleanup all sessions on worker shutdown
 */
export async function cleanupAllSessions(): Promise<void> {
  logger.info(
    { count: activeSessions.size },
    "[ChannelSessions] Cleaning up all sessions..."
  );

  const stopPromises = Array.from(activeSessions.values()).map((session) =>
    session.stop()
  );

  await Promise.all(stopPromises);
  activeSessions.clear();

  logger.info("[ChannelSessions] ✅ All sessions cleaned up");
}
