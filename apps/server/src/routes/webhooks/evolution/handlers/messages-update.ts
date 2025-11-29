import { and, eq, message, chat } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";
import { MessageStatusService } from "~/libs/whatsapp/message-status.service";

import type { MessageData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Tipo de dados para messages.update
 * Similar ao MessagesUpsertData mas indica atualização de status
 */
export interface MessagesUpdateData {
  messages: MessageData[];
}

/**
 * Handler: Messages Update
 *
 * Processa atualizações de status de mensagens (delivered, read, etc)
 */
export async function handleMessagesUpdate(
  instanceName: string,
  data: MessagesUpdateData,
) {
  const logger = new WebhookLogger("messages.update", instanceName);

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Channel not found");
    return;
  }

  logger.info(`${data.messages.length} messages updated`);

  const tenantDb = await tenantManager.getConnection(ch.organizationId);
  const socketManager = getSocketManager();
  const statusService = new MessageStatusService();

  for (const msg of data.messages) {
    try {
      logger.info("Processing update", {
        id: msg.key.id,
        fromMe: msg.key.fromMe,
      });

      // Buscar mensagem no DB pelo whatsappMessageId
      const [existingMessage] = await tenantDb
        .select()
        .from(message)
        .where(eq(message.whatsappMessageId, msg.key.id))
        .limit(1);

      if (!existingMessage) {
        logger.warn("Message not found in DB", { id: msg.key.id });
        continue;
      }

      // Extract and map status using service
      const statusCode = statusService.extractStatusCode(msg.message);
      if (!statusCode) {
        logger.info("No status code found in message");
        continue;
      }

      const newStatus = statusService.mapStatusCode(statusCode);
      if (!newStatus) {
        logger.warn("Could not map status code", { statusCode });
        continue;
      }

      // Only update if status changed
      if (newStatus === existingMessage.status) {
        logger.info("Status unchanged, skipping");
        continue;
      }

      logger.info("Updating status", {
        messageId: existingMessage.id,
        oldStatus: existingMessage.status,
        newStatus,
      });

      // Create update data with timestamps
      const updateData = statusService.createStatusUpdateData(newStatus);

      await tenantDb
        .update(message)
        .set(updateData)
        .where(
          and(
            eq(message.id, existingMessage.id),
            eq(message.timestamp, existingMessage.timestamp),
          ),
        );

      // Buscar chat para verificar se essa é a última mensagem
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(eq(chat.id, existingMessage.chatId))
        .limit(1);

      if (chatRecord) {
        // Verificar se essa mensagem é a última do chat (comparar timestamps)
        const isLastMessage =
          chatRecord.lastMessageAt &&
          existingMessage.timestamp.getTime() === chatRecord.lastMessageAt.getTime();

        if (isLastMessage) {
          // Atualizar lastMessageStatus no chat
          await tenantDb
            .update(chat)
            .set({
              lastMessageStatus: newStatus,
            })
            .where(eq(chat.id, existingMessage.chatId));

          logger.info("Updated chat lastMessageStatus", {
            chatId: existingMessage.chatId,
            status: newStatus,
          });
        }
      }

      // Emitir evento Socket.io
      socketManager.emitToRoom(`org:${ch.organizationId}`, "message:status", {
        messageId: existingMessage.id,
        chatId: existingMessage.chatId,
        status: newStatus,
        sender: existingMessage.sender,
        timestamp: existingMessage.timestamp.toISOString(),
      });

      logger.info("Status updated successfully", { id: msg.key.id });
    } catch (error) {
      logger.error("Error processing update", error);
    }
  }
}
