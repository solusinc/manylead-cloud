import type { Redis, RedisOptions } from "ioredis";

export type { Redis, RedisOptions };

export type RedisConfigPreset =
  | "default" // Standard connection
  | "queue" // BullMQ optimized
  | "pubsub" // Pub/Sub optimized
  | "cache" // Caching optimized
  | "high-latency"; // High-latency network optimized

export interface CreateRedisClientOptions {
  url: string;
  preset?: RedisConfigPreset;
  config?: Partial<RedisOptions>;
  logger?: {
    info: (message: string) => void;
    error: (data: { err: Error }, message: string) => void;
    warn: (message: string) => void;
  };
}
