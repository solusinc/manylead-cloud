import type { Worker } from "bullmq";
import { env } from "~/env";
import { closeRedis } from "~/libs/cache/redis";
import { createWorkers } from "~/libs/queue/workers";
import { logger } from "~/libs/utils/logger";

/**
 * Worker entry point
 */
function startWorker() {
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

  // Close Redis connection
  await closeRedis();

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

// Start the worker
void startWorker();
