import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { getQueueConfig } from "./config";
import type { CreateQueueOptions, CreateWorkerOptions } from "./types";

/**
 * Create BullMQ Queue
 *
 * Pattern: Queue factory with preset configurations
 * Based on: packages/shared/src/queue/media-download-queue.ts, attachment-cleanup-queue.ts
 *
 * @example
 * ```typescript
 * import { createQueue } from "@manylead/clients/queue";
 * import { createRedisClient } from "@manylead/clients/redis";
 *
 * const connection = createRedisClient({
 *   url: env.REDIS_URL,
 *   preset: "queue",
 * });
 *
 * const queue = createQueue({
 *   name: "media-download",
 *   connection,
 *   preset: "media-download",
 * });
 * ```
 */
export function createQueue<T = unknown>(
  options: CreateQueueOptions,
): Queue<T> {
  const { name, connection, preset = "default", config = {}, logger } = options;

  const baseConfig = getQueueConfig(preset);

  const queue = new Queue<T>(name, {
    connection,
    ...baseConfig,
    ...config,
  });

  if (logger) {
    logger.info({ queue: name, preset }, "Queue created");
  }

  return queue;
}

/**
 * Create BullMQ Worker
 *
 * Pattern: Worker factory with concurrency and logging
 * Based on: apps/worker/src/libs/queue/workers.ts
 *
 * @example
 * ```typescript
 * import { createWorker } from "@manylead/clients/queue";
 * import { createRedisClient } from "@manylead/clients/redis";
 * import { createLogger } from "@manylead/clients/logger";
 *
 * const logger = createLogger({ component: "Worker" });
 * const connection = createRedisClient({
 *   url: env.REDIS_URL,
 *   preset: "queue",
 * });
 *
 * const worker = createWorker({
 *   name: "media-download",
 *   connection,
 *   processor: async (job) => {
 *     // Process job
 *   },
 *   concurrency: 5,
 *   logger,
 * });
 * ```
 */
export function createWorker<T = unknown>(
  options: CreateWorkerOptions<T>,
): Worker<T> {
  const {
    name,
    connection,
    processor,
    concurrency = 5,
    config = {},
    logger,
  } = options;

  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency,
    ...config,
  });

  // Event listeners with structured logging
  if (logger) {
    worker.on("completed", (job: Job<T>) => {
      logger.info({ jobId: job.id, queue: name }, "Job completed");
    });

    worker.on("failed", (job: Job<T> | undefined, error: Error) => {
      logger.error(
        { jobId: job?.id, queue: name, error: error.message },
        "Job failed",
      );
    });

    worker.on("error", (error: Error) => {
      logger.error({ queue: name, error: error.message }, "Worker error");
    });

    worker.on("progress", (job: Job<T>, progress) => {
      logger.debug(
        { jobId: job.id ?? "unknown", queue: name, progress },
        "Job progress",
      );
    });
  }

  return worker;
}

export type { Queue, Worker, QueueEvents, Job, Processor } from "bullmq";
export * from "./config";
export * from "./types";
