import type { Job } from "bullmq";
import { db, organization, scheduledMessage, eq, and, lt } from "@manylead/db";
import { createQueue } from "@manylead/clients/queue";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";
import { getRedisClient } from "~/libs/cache/redis";

const logger = createLogger("Worker:ScheduledMessageRecovery");

/**
 * Job data for scheduled message recovery
 */
export interface ScheduledMessageRecoveryJobData {
  organizationId?: string; // Se não fornecido, processa todas as orgs
}

/**
 * Recover missed scheduled messages
 *
 * Busca schedules que:
 * 1. status = "pending"
 * 2. scheduledAt < now
 * 3. Verifica se job existe no Redis
 * 4. Re-cria jobs perdidos ou marca como expired (> 24h atrasado)
 */
export async function recoverMissedSchedules(
  job: Job<ScheduledMessageRecoveryJobData>,
): Promise<void> {
  const { organizationId } = job.data;

  logger.info(
    { organizationId: organizationId ?? "all" },
    "Starting scheduled message recovery",
  );

  const startTime = Date.now();
  let totalRecovered = 0;
  let totalExpired = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    // 1. Buscar todas as organizações (ou apenas a especificada)
    const organizations = organizationId
      ? [{ id: organizationId }]
      : await db.select({ id: organization.id }).from(organization);

    logger.info(
      { organizationCount: organizations.length },
      "Processing organizations",
    );

    // 2. Criar queue uma única vez (reutilizar conexão)
    const connection = getRedisClient();
    const queue = createQueue({
      name: "scheduled-message",
      connection,
    });

    // 3. Para cada organização
    for (const org of organizations) {
      try {
        const tenantDb = await tenantManager.getConnection(org.id);
        const now = new Date();
        const expirationThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h atrás

        // 4. Buscar schedules pendentes e atrasados
        const missedSchedules = await tenantDb
          .select()
          .from(scheduledMessage)
          .where(
            and(
              eq(scheduledMessage.status, "pending"),
              lt(scheduledMessage.scheduledAt, now),
            ),
          );

        if (missedSchedules.length === 0) {
          continue;
        }

        logger.info(
          { organizationId: org.id, missedCount: missedSchedules.length },
          "Found missed schedules",
        );

        // 5. Processar cada schedule
        for (const schedule of missedSchedules) {
          try {
            const scheduledAt = new Date(schedule.scheduledAt);

            // 5.1. Verificar se passou mais de 24h (expirado)
            if (scheduledAt < expirationThreshold) {
              logger.warn(
                {
                  scheduledMessageId: schedule.id,
                  organizationId: org.id,
                  scheduledAt: scheduledAt.toISOString(),
                  delayMinutes: Math.round((now.getTime() - scheduledAt.getTime()) / 1000 / 60),
                },
                "Schedule expired (>24h late) - marking as expired",
              );

              await tenantDb
                .update(scheduledMessage)
                .set({
                  status: "expired",
                  errorMessage: "Expired: more than 24 hours past scheduled time",
                  updatedAt: now,
                })
                .where(eq(scheduledMessage.id, schedule.id));

              totalExpired++;
              continue;
            }

            // 5.2. Gerar jobId único com organizationId + scheduleId
            const jobId = `scheduled-${org.id}-${schedule.id}`;

            // 5.3. Verificar se job já existe no Redis (evitar duplicação)
            const existingJob = await queue.getJob(jobId);

            if (existingJob) {
              // Job existe, não precisa fazer nada
              logger.debug(
                { scheduledMessageId: schedule.id, organizationId: org.id, jobId },
                "Job already exists in queue - skipping",
              );

              // Atualizar jobId no banco se estiver diferente
              if (schedule.jobId !== jobId) {
                await tenantDb
                  .update(scheduledMessage)
                  .set({ jobId, updatedAt: now })
                  .where(eq(scheduledMessage.id, schedule.id));
              }

              totalSkipped++;
              continue;
            }

            // 5.4. Job não existe - criar novo job para execução imediata
            const delayMinutes = Math.round((now.getTime() - scheduledAt.getTime()) / 1000 / 60);

            logger.info(
              {
                scheduledMessageId: schedule.id,
                organizationId: org.id,
                scheduledAt: scheduledAt.toISOString(),
                delayMinutes,
                jobId,
              },
              "Recovering missed schedule - creating immediate job",
            );

            await queue.add(
              "send-scheduled-message",
              {
                scheduledMessageId: schedule.id,
                organizationId: org.id,
                chatId: schedule.chatId,
                chatCreatedAt: schedule.chatCreatedAt.toISOString(),
                contentType: schedule.contentType,
                content: schedule.content,
                createdByAgentId: schedule.createdByAgentId,
              },
              {
                delay: 0, // Executar imediatamente
                jobId, // Chave única: org + schedule
                attempts: 3,
                backoff: {
                  type: "exponential",
                  delay: 5000,
                },
                removeOnComplete: {
                  age: 7 * 24 * 60 * 60, // 7 dias
                },
                removeOnFail: {
                  age: 30 * 24 * 60 * 60, // 30 dias
                },
              },
            );

            // Atualizar jobId no banco
            await tenantDb
              .update(scheduledMessage)
              .set({ jobId, updatedAt: now })
              .where(eq(scheduledMessage.id, schedule.id));

            totalRecovered++;
          } catch (error) {
            logger.error(
              {
                scheduledMessageId: schedule.id,
                organizationId: org.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to recover individual schedule",
            );
            totalErrors++;
          }
        }
      } catch (error) {
        logger.error(
          {
            organizationId: org.id,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          "Failed to process organization",
        );
        totalErrors++;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      {
        totalRecovered,
        totalExpired,
        totalSkipped,
        totalErrors,
        durationMs: duration,
      },
      "Scheduled message recovery completed",
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to recover missed schedules",
    );
    throw error;
  }
}
