import { channel, CHANNEL_STATUS, eq } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";
import type { ConnectionUpdateData } from "../types";
import { findChannelByInstanceName, WebhookLogger } from "../utils";

/**
 * Handler: Connection Update
 *
 * Atualiza status do canal quando conexão muda (open/close/connecting)
 */
export async function handleConnectionUpdate(
  instanceName: string,
  data: ConnectionUpdateData,
) {
  const logger = new WebhookLogger("connection.update", instanceName);

  logger.info("Connection state changed", { state: data.state });

  // Buscar canal
  const ch = await findChannelByInstanceName(instanceName);
  if (!ch) {
    logger.warn("Canal não encontrado");
    return;
  }

  // Mapear state do Evolution para status do canal
  let newStatus = ch.status;
  const { state, statusReason, wuid, profileName, profilePictureUrl } = data;

  switch (state) {
    case "open":
      newStatus = CHANNEL_STATUS.CONNECTED;
      logger.info("Canal conectado!");
      break;

    case "close":
      newStatus = CHANNEL_STATUS.DISCONNECTED;
      logger.info("Canal desconectado");
      break;

    case "connecting":
      newStatus = CHANNEL_STATUS.PENDING;
      logger.info("Canal conectando...");
      break;
  }

  // Extrair número de telefone do wuid (formato: 551151988991@s.whatsapp.net)
  let phoneNumber = ch.phoneNumber;
  if (wuid && state === "open") {
    phoneNumber = wuid.split("@")[0] ?? ch.phoneNumber;
  }

  // Atualizar no DB
  const tenantDb = await tenantManager.getConnection(ch.organizationId);

  await tenantDb
    .update(channel)
    .set({
      status: newStatus,
      evolutionConnectionState: state,
      phoneNumber: phoneNumber,
      displayName: profileName ?? ch.displayName,
      profilePictureUrl: profilePictureUrl ?? ch.profilePictureUrl,
      lastConnectedAt: state === "open" ? new Date() : ch.lastConnectedAt,
      errorMessage: statusReason?.toString(),
      updatedAt: new Date(),
    })
    .where(eq(channel.id, ch.id));

  logger.info("Status atualizado no DB", {
    channelId: ch.id,
    status: newStatus,
  });

  // Emitir evento via Socket.io
  const socketManager = getSocketManager();
  socketManager.emitToRoom(`org:${ch.organizationId}`, "channel:status", {
    channelId: ch.id,
    status: newStatus,
    connectionState: state,
  });

  logger.info("Evento emitido via Socket.io");
}
