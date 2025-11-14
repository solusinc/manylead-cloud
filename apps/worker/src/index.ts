import type { Worker } from "bullmq";
import { env } from "~/env";
import { closeRedis, getRedisClient } from "~/libs/cache/redis";
import { createWorkers } from "~/libs/queue/workers";
import { logger } from "~/libs/utils/logger";
import { cleanupAllSessions } from "~/workers/channel-sessions";
import { subscribeToChannelEvents } from "~/services/baileys/event-subscriber";

/**
 * Worker entry point
 */
async function startWorker() {
  logger.info("🚀 Starting BullMQ Worker...");
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Concurrency: ${env.WORKER_CONCURRENCY}`);

  let workers: Worker[] = [];

  try {
    // Create and start all workers
    logger.info("Creating workers...");
    workers = createWorkers();

    logger.info(
      {
        queues: workers.map((w) => w.name),
        concurrency: env.WORKER_CONCURRENCY,
      },
      "Workers started successfully",
    );

    // Subscribe to channel events (QR code updates, connections, etc.)
    logger.info("Subscribing to channel events...");
    await subscribeToChannelEvents(getRedisClient());
    logger.info("✅ Event subscriber started");

    // Keep process alive
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, shutting down gracefully");
      void gracefulShutdown(workers);
    });

    process.on("SIGINT", () => {
      logger.info("SIGINT received, shutting down gracefully");
      void gracefulShutdown(workers);
    });
  } catch (error) {
    logger.error(
      {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to start workers",
    );
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(workers: Worker[]) {
  logger.info("Closing workers...");

  // Close all workers
  await Promise.all(
    workers.map(async (worker) => {
      logger.info({ worker: worker.name }, "Closing worker");
      await worker.close();
    }),
  );

  // Cleanup Baileys sessions
  await cleanupAllSessions();

  // Close Redis connection
  await closeRedis();

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

// Start the worker
void startWorker();
