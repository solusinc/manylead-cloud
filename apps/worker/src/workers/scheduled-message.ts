import type { Job } from "bullmq";
import {
  agent,
  and,
  chat,
  contact,
  db,
  eq,
  organization,
  quickReply,
  scheduledMessage,
  user,
} from "@manylead/db";
import type { QuickReplyMessage } from "@manylead/db";
import { getInternalMessageService } from "@manylead/messaging";
import type { MessageContext } from "@manylead/messaging";
import { extractKeyFromUrl } from "@manylead/storage";
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

    // Inicializar MessageService
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

    // 6. Se for quick reply, processar e enviar múltiplas mensagens
    if (schedule.quickReplyId) {
      logger.info(
        { scheduledMessageId, quickReplyId: schedule.quickReplyId },
        "Processing quick reply scheduled message",
      );

      // Buscar quick reply atualizada
      const [quickReplyData] = await tenantDb
        .select()
        .from(quickReply)
        .where(eq(quickReply.id, schedule.quickReplyId))
        .limit(1);

      if (!quickReplyData?.isActive) {
        // Quick reply deletada ou desativada - marcar como failed
        await tenantDb
          .update(scheduledMessage)
          .set({
            status: "failed",
            errorMessage: "Resposta rápida não está mais disponível",
            updatedAt: new Date(),
          })
          .where(eq(scheduledMessage.id, scheduledMessageId));

        logger.warn(
          { scheduledMessageId, quickReplyId: schedule.quickReplyId },
          "Quick reply not found or inactive - marked as failed",
        );
        return;
      }

      // Buscar dados do contato para variáveis
      const [chatData] = await tenantDb
        .select({
          contactName: contact.name,
        })
        .from(chat)
        .innerJoin(contact, eq(chat.contactId, contact.id))
        .where(and(eq(chat.id, chatId), eq(chat.createdAt, new Date(chatCreatedAt))))
        .limit(1);

      // Buscar nome da organização
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1);

      // Substituir variáveis em cada mensagem
      const processedMessages: QuickReplyMessage[] = quickReplyData.messages.map((msg) => ({
        ...msg,
        content: msg.content
          .replace(/\{\{contact\.name\}\}/g, chatData?.contactName ?? "")
          .replace(/\{\{agent\.name\}\}/g, userRecord.name)
          .replace(/\{\{organization\.name\}\}/g, org?.name ?? ""),
      }));

      // Enviar cada mensagem da quick reply
      for (const message of processedMessages) {
        if (message.mediaUrl?.startsWith("http")) {
          // Mensagem com mídia
          const storagePath = extractKeyFromUrl(message.mediaUrl);

          const messageType =
            message.type === "image" ? "image" : message.type === "audio" ? "audio" : "document";

          await messageService.createTextMessage(messageContext, {
            chatId,
            content: message.content,
            messageType,
            agentId: createdByAgentId,
            agentName: userRecord.name,
            attachmentData: {
              fileName: message.mediaName ?? "file",
              mimeType: message.mediaMimeType ?? "application/octet-stream",
              mediaType: messageType,
              storagePath: storagePath ?? "",
              storageUrl: message.mediaUrl,
            },
          });
        } else {
          // Mensagem de texto puro
          await messageService.createTextMessage(messageContext, {
            chatId,
            content: message.content,
            agentId: createdByAgentId,
            agentName: userRecord.name,
          });
        }

        // Delay de 150ms entre mensagens
        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });
      }

      // Marcar como sent
      await tenantDb
        .update(scheduledMessage)
        .set({
          status: "sent",
          sentAt: new Date(),
          updatedAt: new Date(),
          metadata: {
            ...schedule.metadata,
            history: [
              ...schedule.metadata.history,
              {
                action: "sent" as const,
                timestamp: new Date().toISOString(),
                details: {
                  jobId: job.id,
                  quickReplyId: schedule.quickReplyId,
                  messagesCount: processedMessages.length,
                },
              },
            ],
          },
        })
        .where(eq(scheduledMessage.id, scheduledMessageId));

      logger.info(
        { scheduledMessageId, messagesCount: processedMessages.length },
        "Quick reply scheduled message sent successfully",
      );

      // Publicar evento via Redis
      await eventPublisher.publish("chat:events", {
        type: "scheduled:sent",
        organizationId,
        chatId,
        data: {
          scheduledMessageId,
          quickReplyId: schedule.quickReplyId,
          messagesCount: processedMessages.length,
          contentType,
        },
      });

      return;
    }

    // 7. Lógica existente para mensagens normais e comentários
    const result = await messageService.createTextMessage(messageContext, {
      chatId,
      content,
      messageType: contentType === "comment" ? "comment" : "text",
      agentId: createdByAgentId,
      agentName: userRecord.name,
      metadata: {
        agentId: createdByAgentId,
      },
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
