import { getSocketManager } from "~/socket";

import type { MessagesUpsertData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Handler: Messages Upsert
 *
 * Processa mensagens recebidas de clientes
 *
 * TODO (Fase futura):
 * - Criar/atualizar contato
 * - Criar/atualizar conversa
 * - Salvar mensagem no DB
 * - Atribuir para agente
 * - Aplicar regras de roteamento
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

  const socketManager = getSocketManager();

  for (const msg of data.messages) {
    // Ignorar mensagens enviadas por nós
    if (msg.key.fromMe) {
      logger.info("Ignorando mensagem enviada por nós", { id: msg.key.id });
      continue;
    }

    logger.info("Processando mensagem", {
      from: msg.key.remoteJid,
      id: msg.key.id,
      type: msg.messageType,
    });

    // TODO: Processar mensagem completa
    // - Extrair texto/mídia da mensagem
    // - Salvar no DB
    // - Criar conversa se não existir
    // - Atribuir para agente

    // Por enquanto, apenas emitir via Socket.io
    socketManager.emitToRoom(`org:${ch.organizationId}`, "message:received", {
      channelId: ch.id,
      from: msg.key.remoteJid,
      message: msg.message,
      messageType: msg.messageType,
      timestamp: msg.messageTimestamp,
      pushName: msg.pushName,
      messageId: msg.key.id,
    });

    logger.info("Mensagem emitida via Socket.io", { id: msg.key.id });
  }
}
