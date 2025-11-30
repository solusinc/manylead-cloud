import type { Queue } from "bullmq";
import { createLogger } from "~/libs/utils/logger";

const logger = createLogger("Worker:Health");

export interface QueueHealth {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  completed: number;
  total: number;
  isHealthy: boolean;
  warnings: string[];
}

export interface SystemHealth {
  queues: QueueHealth[];
  overall: {
    isHealthy: boolean;
    totalJobs: number;
    totalFailed: number;
    warnings: string[];
  };
  timestamp: string;
}

/**
 * Health check thresholds
 */
const THRESHOLDS = {
  maxWaiting: 1000, // Max jobs waiting in queue
  maxFailed: 100, // Max failed jobs before alert
  maxActive: 50, // Max concurrent active jobs
} as const;

/**
 * Get health status for a single queue
 */
async function getQueueHealth(
  name: string,
  queue: Queue,
): Promise<QueueHealth> {
  const [waiting, active, failed, delayed, completed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getCompletedCount(),
  ]);

  const total = waiting + active + failed + delayed;
  const warnings: string[] = [];

  // Check thresholds
  if (waiting > THRESHOLDS.maxWaiting) {
    warnings.push(
      `High waiting count: ${waiting} (threshold: ${THRESHOLDS.maxWaiting})`,
    );
  }

  if (failed > THRESHOLDS.maxFailed) {
    warnings.push(
      `High failed count: ${failed} (threshold: ${THRESHOLDS.maxFailed})`,
    );
  }

  if (active > THRESHOLDS.maxActive) {
    warnings.push(
      `High active count: ${active} (threshold: ${THRESHOLDS.maxActive})`,
    );
  }

  const isHealthy = warnings.length === 0;

  return {
    name,
    waiting,
    active,
    failed,
    delayed,
    completed,
    total,
    isHealthy,
    warnings,
  };
}

/**
 * Get health status for all queues
 */
export async function getSystemHealth(
  queues: { name: string; queue: Queue }[],
): Promise<SystemHealth> {
  const queueHealths = await Promise.all(
    queues.map(({ name, queue }) => getQueueHealth(name, queue)),
  );

  const totalJobs = queueHealths.reduce((sum, q) => sum + q.total, 0);
  const totalFailed = queueHealths.reduce((sum, q) => sum + q.failed, 0);
  const allWarnings = queueHealths.flatMap((q) => q.warnings);

  const overall = {
    isHealthy: queueHealths.every((q) => q.isHealthy),
    totalJobs,
    totalFailed,
    warnings: allWarnings,
  };

  return {
    queues: queueHealths,
    overall,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log health status
 */
export async function logHealthStatus(
  queues: { name: string; queue: Queue }[],
): Promise<void> {
  const health = await getSystemHealth(queues);

  if (!health.overall.isHealthy) {
    logger.warn(
      {
        totalJobs: health.overall.totalJobs,
        totalFailed: health.overall.totalFailed,
        warnings: health.overall.warnings,
        queues: health.queues
          .filter((q) => !q.isHealthy)
          .map((q) => ({
            name: q.name,
            waiting: q.waiting,
            active: q.active,
            failed: q.failed,
            warnings: q.warnings,
          })),
      },
      "⚠️  Queue health check failed",
    );
  } else {
    logger.info(
      {
        totalJobs: health.overall.totalJobs,
        queues: health.queues.map((q) => ({
          name: q.name,
          waiting: q.waiting,
          active: q.active,
          failed: q.failed,
        })),
      },
      "✅ Queue health check passed",
    );
  }
}

/**
 * Get detailed queue statistics
 */
export async function getQueueStats(queue: Queue) {
  const [
    waiting,
    active,
    failed,
    delayed,
    completed,
    repeatableJobs,
    jobs,
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getCompletedCount(),
    queue.getRepeatableJobs(),
    queue.getJobs(["waiting", "active", "failed"], 0, 10),
  ]);

  return {
    counts: {
      waiting,
      active,
      failed,
      delayed,
      completed,
      total: waiting + active + failed + delayed,
    },
    repeatableJobs: repeatableJobs.map((job) => ({
      key: job.key,
      name: job.name,
      pattern: job.pattern,
      next: job.next,
    })),
    recentJobs: jobs.map((job) => ({
      id: job.id,
      name: job.name,
      state: job.getState(),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    })),
  };
}
