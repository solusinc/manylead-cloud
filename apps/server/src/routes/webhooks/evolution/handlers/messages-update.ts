import { and, eq, message } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";

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
    logger.warn("Canal não encontrado");
    return;
  }

  logger.info(`${data.messages.length} mensagens atualizadas`);

  const tenantDb = await tenantManager.getConnection(ch.organizationId);
  const socketManager = getSocketManager();

  for (const msg of data.messages) {
    try {
      logger.info("Processando atualização", {
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
        logger.warn("Mensagem não encontrada no DB", { id: msg.key.id });
        continue;
      }

      // Extrair status da mensagem (formato Evolution API)
      // O status pode vir em msg.status ou em msg.message?.status
      let newStatus = existingMessage.status;

      // Tentar extrair status do payload
      if (msg.message) {
        const msgObj = msg.message;
        if (msgObj.status) {
          const statusCode = Number(msgObj.status);

          // Evolution API status codes:
          // 1 = PENDING
          // 2 = SERVER_ACK (sent)
          // 3 = DELIVERY_ACK (delivered)
          // 4 = READ (read)
          // 5 = PLAYED (audio/video played)
          switch (statusCode) {
            case 2:
              newStatus = "sent";
              break;
            case 3:
              newStatus = "delivered";
              break;
            case 4:
              newStatus = "read";
              break;
            default:
              logger.warn("Status code desconhecido", { statusCode });
          }
        }
      }

      // Só atualizar se o status mudou
      if (newStatus === existingMessage.status) {
        logger.info("Status não mudou, ignorando");
        continue;
      }

      logger.info("Atualizando status", {
        messageId: existingMessage.id,
        oldStatus: existingMessage.status,
        newStatus,
      });

      // Atualizar mensagem
      const updateData: {
        status: typeof newStatus;
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

      // Emitir evento Socket.io
      socketManager.emitToRoom(`org:${ch.organizationId}`, "message:status", {
        messageId: existingMessage.id,
        chatId: existingMessage.chatId,
        status: newStatus,
      });

      logger.info("Status atualizado com sucesso", { id: msg.key.id });
    } catch (error) {
      logger.error("Erro ao processar atualização", error);
    }
  }
}
