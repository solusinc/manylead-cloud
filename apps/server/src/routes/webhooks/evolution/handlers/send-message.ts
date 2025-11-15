import type { SendMessageData } from "../types";
import { WebhookLogger } from "../utils";

/**
 * Handler: Send Message
 *
 * Confirmação de mensagem enviada
 *
 * TODO (Fase futura):
 * - Atualizar status da mensagem no DB (sent, delivered, read)
 * - Emitir confirmação via Socket.io para o agente
 */
export function handleSendMessage(
  instanceName: string,
  data: SendMessageData,
) {
  const logger = new WebhookLogger("send.message", instanceName);

  logger.info("Mensagem enviada confirmada", {
    to: data.key.remoteJid,
    id: data.key.id,
    status: data.status,
  });

  // TODO: Atualizar status da mensagem no DB
  // TODO: Emitir confirmação via Socket.io
}
