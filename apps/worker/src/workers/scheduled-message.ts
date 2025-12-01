import type { Job } from "bullmq";
import { and, eq, scheduledMessage } from "@manylead/db";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";
import { eventPublisher } from "~/libs/cache/event-publisher";

const logger = createLogger("Worker:ScheduledMessage");

/**
 * Job data for scheduled message
 */
export interface ScheduledMessageJobData {
  scheduledMessageId: string;
  organizationId: string;
  chatId: string;
  chatCreatedAt: string; // ISO string
  contentType: "message" | "comment";
  content: string;
  createdByAgentId: string;
}

/**
 * Process scheduled message job
 *
 * Fluxo:
 * 1. Verificar se agendamento ainda está pendente (pode ter sido cancelado)
 * 2. Atualizar status para processing
 * 3. TODO: Criar mensagem/comment usando MessageService
 * 4. Atualizar scheduled_message com sentAt, sentMessageId
 * 5. Publicar evento via Redis Pub/Sub
 */
export async function processScheduledMessage(
  job: Job<ScheduledMessageJobData>,
): Promise<void> {
  const {
    scheduledMessageId,
    organizationId,
    chatId,
    contentType,
  } = job.data;

  logger.info(
    {
      scheduledMessageId,
      organizationId,
      chatId,
      contentType,
    },
    "Processing scheduled message",
  );

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // 1. Verificar se agendamento ainda está pendente
    const [schedule] = await tenantDb
      .select()
      .from(scheduledMessage)
      .where(
        and(
          eq(scheduledMessage.id, scheduledMessageId),
          eq(scheduledMessage.status, "pending"),
        ),
      )
      .limit(1);

    if (!schedule) {
      logger.warn(
        { scheduledMessageId },
        "Scheduled message not found or not pending - skipping",
      );
      return;
    }

    // 2. Atualizar status para processing
    await tenantDb
      .update(scheduledMessage)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessage.id, scheduledMessageId));

    // 3. TODO: Verificar se chat existe e criar mensagem
    // Por enquanto, apenas marcar como enviado
    // Este TODO será implementado quando integrar com MessageService

    // 4. Atualizar como enviado (temporário - será substituído)
    await tenantDb
      .update(scheduledMessage)
      .set({
        status: "sent",
        sentAt: new Date(),
        // sentMessageId: newMessage.id, // TODO: quando criar a mensagem
        metadata: {
          ...schedule.metadata,
          history: [
            ...schedule.metadata.history,
            {
              action: "sent" as const,
              timestamp: new Date().toISOString(),
              details: { jobId: job.id },
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessage.id, scheduledMessageId));

    // 5. Publicar evento
    await eventPublisher.publish("chat:events", {
      type: "scheduled:sent",
      organizationId,
      chatId,
      data: {
        scheduledMessageId,
        // messageId: newMessage.id, // TODO
        contentType,
      },
    });

    logger.info(
      { scheduledMessageId, chatId },
      "Scheduled message sent successfully",
    );
  } catch (error) {
    logger.error(
      {
        scheduledMessageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to process scheduled message",
    );

    // Atualizar como failed
    await tenantDb
      .update(scheduledMessage)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: (await tenantDb
          .select({ retryCount: scheduledMessage.retryCount })
          .from(scheduledMessage)
          .where(eq(scheduledMessage.id, scheduledMessageId))
          .then((r) => r[0]?.retryCount ?? 0)) + 1,
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessage.id, scheduledMessageId));

    throw error; // Re-throw para BullMQ retry
  }
}
