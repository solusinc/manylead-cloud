import type { MessagesUpsertData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";
import { WhatsAppMessageProcessor } from "~/libs/whatsapp/message-processor.service";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Handler: Messages Upsert
 *
 * Processa mensagens recebidas do WhatsApp
 */
export async function handleMessagesUpsert(
  instanceName: string,
  data: MessagesUpsertData,
) {
  const logger = new WebhookLogger("messages.upsert", instanceName);

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado");
    return;
  }

  logger.info(`${data.messages.length} mensagens recebidas`);

  // Criar processor
  const processor = new WhatsAppMessageProcessor(tenantManager);

  // Processar cada mensagem
  for (const msg of data.messages) {
    logger.info("Processando mensagem", {
      from: msg.key.remoteJid,
      id: msg.key.id,
      type: msg.messageType,
    });

    try {
      await processor.processMessage(msg, ch, instanceName);
      logger.info("Mensagem processada com sucesso", { id: msg.key.id });
    } catch (error) {
      logger.error("Erro ao processar mensagem", error);
    }
  }
}
