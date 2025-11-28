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
    logger.warn("Empty QR code in payload");
    return;
  }

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Channel not found");
    return;
  }

  logger.info("QR Code received", {
    channelId: ch.id,
    organizationId: ch.organizationId,
  });

  // Emitir via Socket.io para o frontend
  const socketManager = getSocketManager();
  socketManager.emitToRoom(`org:${ch.organizationId}`, "channel:qrcode", {
    channelId: ch.id,
    qrCode: data.qrcode.base64,
  });

  logger.info("QR Code emitted via Socket.io");
}
