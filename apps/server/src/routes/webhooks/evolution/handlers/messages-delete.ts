import { and, eq, message } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";

import { findChannelByInstanceName, WebhookLogger } from "../utils";
import type { MessagesDeleteData } from "../types";

/**
 * Handler: Messages Delete
 *
 * Processa mensagens deletadas do WhatsApp ("Apagar para todos")
 */
export async function handleMessagesDelete(
  instanceName: string,
  data: MessagesDeleteData,
) {
  const logger = new WebhookLogger("messages.delete", instanceName);

  logger.info("Processing deleted message", {
    whatsappMessageId: data.key.id,
    remoteJid: data.key.remoteJid,
  });

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado", { instanceName });
    return;
  }

  // Buscar mensagem no banco pelo whatsappMessageId
  const tenantDb = await tenantManager.getConnection(ch.organizationId);

  const [messageToDelete] = await tenantDb
    .select()
    .from(message)
    .where(eq(message.whatsappMessageId, data.key.id))
    .limit(1);

  if (!messageToDelete) {
    logger.warn("Message not found for deletion", {
      whatsappMessageId: data.key.id,
      remoteJid: data.key.remoteJid,
    });
    return;
  }

  // Atualizar mensagem como deletada
  const updateData: {
    isDeleted: boolean;
    deletedAt: Date;
  } = {
    isDeleted: true,
    deletedAt: new Date(),
  };

  const [deletedMessage] = await tenantDb
    .update(message)
    .set(updateData)
    .where(
      and(
        eq(message.id, messageToDelete.id),
        eq(message.timestamp, messageToDelete.timestamp),
      ),
    )
    .returning();

  if (!deletedMessage) {
    logger.error("Failed to mark message as deleted");
    return;
  }

  logger.info("Message marked as deleted successfully", {
    messageId: deletedMessage.id,
    whatsappMessageId: data.key.id,
  });

  // Emitir evento Socket.io
  const socketManager = getSocketManager();
  socketManager.emitToRoom(
    `org:${ch.organizationId}`,
    "message:deleted",
    {
      chatId: messageToDelete.chatId,
      messageId: messageToDelete.id,
      timestamp: messageToDelete.timestamp,
    },
  );

  logger.info("Socket.io event emitted", {
    event: "message:deleted",
    messageId: messageToDelete.id,
  });
}
