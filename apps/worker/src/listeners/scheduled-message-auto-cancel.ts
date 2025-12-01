import type { Queue } from "bullmq";
import Redis from "ioredis";
import { and, eq, scheduledMessage } from "@manylead/db";
import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "~/libs/cache/redis";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";
import { env } from "~/env";

const logger = createLogger("Listener:ScheduledMessageAutoCancel");

/**
 * Listener centralizado para cancelamento automático de agendamentos
 *
 * Escuta eventos do canal chat:events e cancela agendamentos pendentes
 * baseado nas regras configuradas:
 * - cancel_on_contact_message
 * - cancel_on_agent_message
 * - cancel_on_chat_close
 */
export async function startScheduledMessageAutoCancelListener(): Promise<void> {
  // Criar Redis subscriber DEDICADO (não usar singleton!)
  // Importante: conexões em modo SUBSCRIBE não podem fazer outros comandos
  const subscriber = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    enableAutoPipelining: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  subscriber.on("error", (err) => {
    logger.error({ err }, "Subscriber Redis error");
  });

  logger.info("Starting scheduled message auto-cancel listener...");

  // Escutar canal chat:events
  await subscriber.subscribe("chat:events", (err) => {
    if (err) {
      logger.error({ error: err.message }, "Failed to subscribe to chat:events");
      return;
    }
    logger.info("Subscribed to chat:events channel");
  });

  // Processar mensagens recebidas
  subscriber.on("message", (channel, message) => {
    if (channel !== "chat:events") return;

    // Usar void para indicar que não esperamos o resultado da Promise
    void (async () => {
      try {
        const event = JSON.parse(message) as {
          type: string;
          organizationId: string;
          chatId: string;
          data?: {
            messageId?: string;
            sender?: "contact" | "agent";
            status?: string;
          };
        };

        logger.debug({ event }, "Received event from chat:events");

        // Determinar qual regra de cancelamento aplicar
        let cancelRule:
          | "contact_message"
          | "agent_message"
          | "chat_closed"
          | null = null;

        if (event.type === "message:created") {
          if (event.data?.sender === "contact") {
            cancelRule = "contact_message";
          } else if (event.data?.sender === "agent") {
            cancelRule = "agent_message";
          }
        } else if (event.type === "chat:finished") {
          cancelRule = "chat_closed";
        }

        if (!cancelRule) {
          // Evento não relevante para cancelamento
          return;
        }

        // Buscar agendamentos pendentes para este chat com a flag ativada
        await cancelPendingScheduledMessages(
          event.organizationId,
          event.chatId,
          cancelRule,
        );
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            message,
          },
          "Error processing chat event for auto-cancel",
        );
      }
    })();
  });

  logger.info("Scheduled message auto-cancel listener started successfully");
}

/**
 * Cancela agendamentos pendentes baseado na regra
 */
async function cancelPendingScheduledMessages(
  organizationId: string,
  chatId: string,
  rule: "contact_message" | "agent_message" | "chat_closed",
): Promise<void> {
  const tenantDb = await tenantManager.getConnection(organizationId);

  // Mapear regra para campo do banco
  const fieldMap = {
    contact_message: scheduledMessage.cancelOnContactMessage,
    agent_message: scheduledMessage.cancelOnAgentMessage,
    chat_closed: scheduledMessage.cancelOnChatClose,
  };

  const cancelField = fieldMap[rule];

  // Buscar agendamentos pendentes com a flag ativada
  const schedulesToCancel = await tenantDb
    .select()
    .from(scheduledMessage)
    .where(
      and(
        eq(scheduledMessage.organizationId, organizationId),
        eq(scheduledMessage.chatId, chatId),
        eq(scheduledMessage.status, "pending"),
        eq(cancelField, true),
      ),
    );

  if (schedulesToCancel.length === 0) {
    logger.debug(
      { organizationId, chatId, rule },
      "No scheduled messages to cancel",
    );
    return;
  }

  logger.info(
    {
      organizationId,
      chatId,
      rule,
      count: schedulesToCancel.length,
    },
    "Cancelling scheduled messages",
  );

  // Criar fila para remover jobs
  const queue: Queue = createQueue({
    name: "scheduled-message",
    connection: getRedisClient(),
  });

  // Cancelar cada agendamento
  for (const schedule of schedulesToCancel) {
    try {
      // 1. Remover job do BullMQ (se existir)
      if (schedule.jobId) {
        const job = await queue.getJob(schedule.jobId);
        if (job) {
          await job.remove();
          logger.debug({ jobId: schedule.jobId }, "Removed BullMQ job");
        }
      }

      // 2. Atualizar status no banco
      await tenantDb
        .update(scheduledMessage)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: rule,
          metadata: {
            ...schedule.metadata,
            history: [
              ...schedule.metadata.history,
              {
                action: "cancelled" as const,
                timestamp: new Date().toISOString(),
                details: {
                  reason: rule,
                  automatic: true,
                },
              },
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(scheduledMessage.id, schedule.id));

      logger.info(
        {
          scheduledMessageId: schedule.id,
          rule,
        },
        "Scheduled message cancelled automatically",
      );
    } catch (error) {
      logger.error(
        {
          scheduledMessageId: schedule.id,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to cancel scheduled message",
      );
    }
  }

  await queue.close();
}
