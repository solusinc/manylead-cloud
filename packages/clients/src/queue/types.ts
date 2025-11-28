import type { QueueOptions, WorkerOptions, Processor } from "bullmq";
import type { Redis } from "ioredis";

export type { Queue, Worker, QueueEvents, Job, Processor } from "bullmq";

export type QueueConfigPreset =
  | "default"
  | "high-priority" // Fast processing with more aggressive retries
  | "low-priority" // Background tasks with generous retention
  | "media-download" // Media download specific
  | "cleanup"; // Cleanup tasks

export interface CreateQueueOptions {
  name: string;
  connection: Redis;
  preset?: QueueConfigPreset;
  config?: Partial<QueueOptions>;
  logger?: {
    info: (data: { queue: string; preset?: string }, message: string) => void;
  };
}

export interface CreateWorkerOptions<T = unknown> {
  name: string;
  connection: Redis;
  processor: Processor<T>;
  concurrency?: number;
  config?: Partial<WorkerOptions>;
  logger?: {
    info: (data: { jobId?: string; queue: string }, message: string) => void;
    error: (
      data: { jobId?: string; queue: string; error: string },
      message: string,
    ) => void;
    debug: (
      data: { jobId: string; queue: string; progress: unknown },
      message: string,
    ) => void;
  };
}
