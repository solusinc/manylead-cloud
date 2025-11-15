import { getSocketManager } from "~/socket";

import type { QRCodeData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Handler: QR Code Updated
 *
 * Emite QR Code atualizado via Socket.io para o frontend
 */
export async function handleQRCodeUpdated(
  instanceName: string,
  data: QRCodeData,
) {
  const logger = new WebhookLogger("qrcode.updated", instanceName);

  // Validar dados
  if (!data.qrcode.base64) {
    logger.warn("QR code vazio no payload");
    return;
  }

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado");
    return;
  }

  logger.info("QR Code recebido", {
    channelId: ch.id,
    organizationId: ch.organizationId,
  });

  // Emitir via Socket.io para o frontend
  const socketManager = getSocketManager();
  socketManager.emitToRoom(`org:${ch.organizationId}`, "channel:qrcode", {
    channelId: ch.id,
    qrCode: data.qrcode.base64,
  });

  logger.info("QR Code emitido via Socket.io");
}
