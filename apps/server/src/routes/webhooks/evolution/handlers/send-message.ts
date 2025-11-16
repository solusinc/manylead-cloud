import { and, eq, message } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";

import type { SendMessageData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Handler: Send Message
 *
 * Confirmação de mensagem enviada (webhook disparado quando enviamos uma mensagem)
 */
export async function handleSendMessage(
  instanceName: string,
  data: SendMessageData,
) {
  const logger = new WebhookLogger("send.message", instanceName);

  logger.info("Mensagem enviada confirmada", {
    to: data.key.remoteJid,
    id: data.key.id,
    status: data.status,
  });

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado");
    return;
  }

  try {
    const tenantDb = await tenantManager.getConnection(ch.organizationId);
    const socketManager = getSocketManager();

    // Buscar mensagem no DB pelo whatsappMessageId
    const [existingMessage] = await tenantDb
      .select()
      .from(message)
      .where(eq(message.whatsappMessageId, data.key.id))
      .limit(1);

    if (!existingMessage) {
      logger.warn("Mensagem não encontrada no DB", { id: data.key.id });
      return;
    }

    // Atualizar status para "sent"
    await tenantDb
      .update(message)
      .set({
        status: "sent",
        sentAt: new Date(),
      })
      .where(
        and(
          eq(message.id, existingMessage.id),
          eq(message.timestamp, existingMessage.timestamp),
        ),
      );

    logger.info("Status atualizado para 'sent'", {
      messageId: existingMessage.id,
    });

    // Emitir evento Socket.io
    socketManager.emitToRoom(`org:${ch.organizationId}`, "message:status", {
      messageId: existingMessage.id,
      chatId: existingMessage.chatId,
      status: "sent",
    });
  } catch (error) {
    logger.error("Erro ao processar confirmação de envio", error);
  }
}
