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
    logger.warn("Canal não encontrado", { instanceName });
    return;
  }

  // Criar processor
  const processor = new WhatsAppMessageProcessor(tenantManager);

  // Processar a mensagem (Evolution API envia uma mensagem por webhook)
  try {
    await processor.processMessage(data, ch, instanceName);
  } catch (error) {
    logger.error("Erro ao processar mensagem", {
      messageId: data.key.id,
      from: data.key.remoteJid,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
