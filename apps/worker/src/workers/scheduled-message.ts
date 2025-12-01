import type { Job } from "bullmq";
import { agent, and, chat, db, eq, scheduledMessage, user } from "@manylead/db";
import { getInternalMessageService } from "@manylead/messaging";
import type { MessageContext } from "@manylead/messaging";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";
import { eventPublisher } from "~/libs/cache/event-publisher";
import { env } from "~/env";

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
 * 3. Verificar se chat existe
 * 4. Buscar agent para pegar o userId
 * 5. Buscar user no catalog DB para pegar o nome
 * 6. Criar mensagem/comment usando InternalMessageService
 * 7. Atualizar scheduled_message com sentAt, sentMessageId
 * 8. Publicar evento via Redis Pub/Sub
 */
export async function processScheduledMessage(
  job: Job<ScheduledMessageJobData>,
): Promise<void> {
  const {
    scheduledMessageId,
    organizationId,
    chatId,
    chatCreatedAt,
    contentType,
    content,
    createdByAgentId,
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

    // 3. Verificar se chat existe
    const [chatRecord] = await tenantDb
      .select()
      .from(chat)
      .where(
        and(
          eq(chat.id, chatId),
          eq(chat.createdAt, new Date(chatCreatedAt)),
        ),
      )
      .limit(1);

    if (!chatRecord) {
      throw new Error("Chat não encontrado");
    }

    // 4. Buscar agent para pegar o userId
    const [agentRecord] = await tenantDb
      .select()
      .from(agent)
      .where(eq(agent.id, createdByAgentId))
      .limit(1);

    if (!agentRecord) {
      throw new Error("Agente não encontrado");
    }

    // 5. Buscar user no catalog DB para pegar o nome
    const [userRecord] = await db
      .select()
      .from(user)
      .where(eq(user.id, agentRecord.userId))
      .limit(1);

    if (!userRecord) {
      throw new Error("Usuário não encontrado");
    }

    // 6. Criar mensagem usando InternalMessageService
    const messageService = getInternalMessageService({
      redisUrl: env.REDIS_URL,
      getTenantConnection: tenantManager.getConnection.bind(tenantManager),
      getCatalogDb: () => db,
    });

    const messageContext: MessageContext = {
      organizationId,
      tenantDb,
      agentId: createdByAgentId,
      agentName: userRecord.name,
    };

    const result = await messageService.createTextMessage(messageContext, {
      chatId,
      content,
      messageType: contentType === "comment" ? "comment" : "text",
      agentId: createdByAgentId,
      agentName: userRecord.name,
    });

    // 7. Atualizar como enviado
    await tenantDb
      .update(scheduledMessage)
      .set({
        status: "sent",
        sentAt: new Date(),
        sentMessageId: result.message.id,
        metadata: {
          ...schedule.metadata,
          history: [
            ...schedule.metadata.history,
            {
              action: "sent" as const,
              timestamp: new Date().toISOString(),
              details: {
                jobId: job.id,
                messageId: result.message.id,
              },
            },
          ],
        },
        updatedAt: new Date(),
      })
      .where(eq(scheduledMessage.id, scheduledMessageId));

    // 8. Publicar evento
    await eventPublisher.publish("chat:events", {
      type: "scheduled:sent",
      organizationId,
      chatId,
      data: {
        scheduledMessageId,
        messageId: result.message.id,
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
