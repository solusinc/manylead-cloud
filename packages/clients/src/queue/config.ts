import type { QueueOptions } from "bullmq";
import type { QueueConfigPreset } from "./types";

/**
 * BullMQ Queue configuration presets
 * Consolidates patterns from:
 * - packages/shared/src/queue/media-download-queue.ts (lines 28-42)
 * - packages/shared/src/queue/attachment-cleanup-queue.ts
 * - apps/server/src/libs/queue/client.ts
 */
export function getQueueConfig(
  preset: QueueConfigPreset,
): Partial<QueueOptions> {
  const baseConfig: Partial<QueueOptions> = {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  };

  switch (preset) {
    case "high-priority":
      return {
        ...baseConfig,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: {
            count: 100,
            age: 3600, // 1 hour
          },
          removeOnFail: {
            count: 200,
          },
        },
      };

    case "media-download":
      // From packages/shared/src/queue/media-download-queue.ts
      return {
        ...baseConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000, // 5s, 25s, 125s
          },
          removeOnComplete: {
            age: 24 * 60 * 60, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 7 * 24 * 60 * 60, // 7 days
          },
        },
      };

    case "cleanup":
      return {
        ...baseConfig,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 10000,
          },
          removeOnComplete: {
            age: 7 * 24 * 60 * 60, // 7 days
            count: 500,
          },
          removeOnFail: {
            age: 30 * 24 * 60 * 60, // 30 days
          },
        },
      };

    case "low-priority":
      return {
        ...baseConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: {
            age: 7 * 24 * 60 * 60, // 7 days
            count: 1000,
          },
          removeOnFail: {
            age: 14 * 24 * 60 * 60, // 14 days
          },
        },
      };

    case "default":
    default:
      return {
        ...baseConfig,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: {
            count: 100,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 500,
          },
        },
      };
  }
}
