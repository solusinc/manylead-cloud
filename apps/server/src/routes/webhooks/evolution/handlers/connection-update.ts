import { channel, CHANNEL_STATUS, eq } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";
import { getEvolutionClient } from "~/libs/evolution-client";
import { channelSyncQueue } from "~/libs/queue/client";
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
      break;

    case "close":
      newStatus = CHANNEL_STATUS.DISCONNECTED;
      break;

    case "connecting":
      newStatus = CHANNEL_STATUS.PENDING;
      break;
  }

  // Extrair número de telefone do wuid (formato: 551151988991@s.whatsapp.net)
  let phoneNumber = ch.phoneNumber;
  if (wuid && state === "open") {
    phoneNumber = wuid.split("@")[0] ?? ch.phoneNumber;
  }

  // Buscar informações completas da instância quando conectar
  let finalProfileName = profileName;
  let finalProfilePictureUrl = profilePictureUrl ?? ch.profilePictureUrl;

  if (state === "open") {
    try {
      const evolutionClient = getEvolutionClient();
      const instanceData = await evolutionClient.instance.fetch(instanceName);

      // Evolution retorna um array ou objeto, pegar o primeiro item se for array
      const instance = Array.isArray(instanceData) ? instanceData[0] : instanceData;

      if (instance) {
        // Se profileName vier null/undefined, manter undefined
        finalProfileName = instance.profileName ?? undefined;
        finalProfilePictureUrl = instance.profilePictureUrl ?? finalProfilePictureUrl;
      }
    } catch (error) {
      logger.error("Failed to fetch instance data from Evolution", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Atualizar no DB
  const tenantDb = await tenantManager.getConnection(ch.organizationId);

  await tenantDb
    .update(channel)
    .set({
      status: newStatus,
      evolutionConnectionState: state,
      phoneNumber: phoneNumber,
      displayName: finalProfileName,
      profilePictureUrl: finalProfilePictureUrl,
      lastConnectedAt: state === "open" ? new Date() : ch.lastConnectedAt,
      errorMessage: statusReason?.toString(),
      updatedAt: new Date(),
    })
    .where(eq(channel.id, ch.id));

  // Emitir evento via Socket.io
  const socketManager = getSocketManager();
  socketManager.emitToRoom(`org:${ch.organizationId}`, "channel:status", {
    channelId: ch.id,
    status: newStatus,
    connectionState: state,
  });

  // Emitir evento específico quando conectado
  if (state === "open") {
    socketManager.emitToRoom(`org:${ch.organizationId}`, "channel:connected", {
      channelId: ch.id,
      phoneNumber,
      displayName: finalProfileName,
      profilePictureUrl: finalProfilePictureUrl,
    });

    // Disparar job de sincronização de mensagens
    await channelSyncQueue.add(
      "sync-messages",
      {
        channelId: ch.id,
        organizationId: ch.organizationId,
      },
      {
        jobId: `channel-sync-${ch.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info("Channel sync job enqueued", { channelId: ch.id });
  }
}
