import { and, eq, message, chat } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";

import { findChannelByInstanceName, WebhookLogger } from "../utils";
import type { MessagesUpdateData } from "../types";

/**
 * Maps Evolution API status string to internal message status
 */
function mapEvolutionStatus(status: string): "sent" | "delivered" | "read" | null {
  switch (status) {
    case "SERVER_ACK":
      return "sent";
    case "DELIVERY_ACK":
      return "delivered";
    case "READ":
    case "PLAYED":
      return "read";
    default:
      return null;
  }
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

  const tenantDb = await tenantManager.getConnection(ch.organizationId);
  const socketManager = getSocketManager();

  try {
    logger.info("Processing status update", {
      keyId: data.keyId,
      status: data.status,
      fromMe: data.fromMe,
    });

    // Buscar mensagem no DB pelo whatsappMessageId
    const [existingMessage] = await tenantDb
      .select()
      .from(message)
      .where(eq(message.whatsappMessageId, data.keyId))
      .limit(1);

    if (!existingMessage) {
      logger.warn("Message not found in DB", { keyId: data.keyId });
      return;
    }

    // Map status string to internal status
    const newStatus = mapEvolutionStatus(data.status);
    if (!newStatus) {
      logger.warn("Could not map status", { status: data.status });
      return;
    }

    // Only update if status changed
    if (newStatus === existingMessage.status) {
      logger.info("Status unchanged, skipping");
      return;
    }

    logger.info("Updating status", {
      messageId: existingMessage.id,
      oldStatus: existingMessage.status,
      newStatus,
    });

    // Create update data with timestamps
    const updateData: {
      status: string;
      deliveredAt?: Date;
      readAt?: Date;
    } = {
      status: newStatus,
    };

    if (newStatus === "delivered") {
      updateData.deliveredAt = new Date();
    }

    if (newStatus === "read") {
      updateData.readAt = new Date();
    }

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

    logger.info("Status updated successfully", { keyId: data.keyId });
  } catch (error) {
    logger.error("Error processing update", error);
  }
}
