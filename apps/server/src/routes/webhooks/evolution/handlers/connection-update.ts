import { channel, CHANNEL_STATUS, eq } from "@manylead/db";

import { getSocketManager } from "~/socket";
import { tenantManager } from "~/libs/tenant-manager";
import { getEvolutionClient } from "~/libs/evolution-client";
import { channelSyncQueue, whatsappLogoSyncQueue } from "~/libs/queue/client";
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
    logger.warn("Channel not found");
    return;
  }

  // Mapear state do Evolution para status do canal
  let newStatus = ch.status;
  const { state, statusReason, wuid, profileName, profilePictureUrl } = data;

  // LOG: Estado atual vs novo
  logger.info("Processing connection.update webhook", {
    channelId: ch.id,
    instanceName,
    currentDbStatus: ch.status,
    currentDbState: ch.evolutionConnectionState,
    incomingState: state,
    hasWuid: !!wuid,
    hasProfileName: !!profileName,
    statusReason: statusReason ?? null,
  });

  // SKIP: Se o estado não mudou, ignorar webhook (evita loop infinito)
  if (ch.evolutionConnectionState === state) {
    logger.info("State unchanged - skipping update", {
      state,
      statusReason: statusReason ?? null,
    });
    return;
  }

  // AUTO-CORREÇÃO: Detectar webhooks desatualizados/atrasados
  // Se webhook representa downgrade de estado (open->connecting, open->close), verificar estado real
  const isDowngrade =
    (state === "connecting" && ch.evolutionConnectionState === "open") ||
    (state === "close" && ch.evolutionConnectionState === "open");

  if (isDowngrade) {
    // Verificar estado real silenciosamente (evita spam de logs)
    try {
      const evolutionClient = getEvolutionClient();
      const instanceData = await evolutionClient.instance.fetch(instanceName);
      const instance = Array.isArray(instanceData) ? instanceData[0] : instanceData;
      const realState = instance?.connectionStatus;

      // Se estado real é diferente do webhook, ignorar silenciosamente
      if (realState && realState !== state) {
        return; // Ignorar webhook desatualizado
      }

      logger.info("Real state confirmed, proceeding with update", {
        webhookState: state,
        realState,
      });
    } catch (error) {
      logger.error("Failed to verify real instance state, proceeding with webhook data", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Se falhar ao verificar, aceitar o webhook (fail-safe)
    }
  }

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
      // Garantir isActive = true quando conectado
      ...(state === "open" && { isActive: true }),
    })
    .where(eq(channel.id, ch.id));

  // LOG: Resultado da atualização
  logger.info("Connection status updated in database", {
    channelId: ch.id,
    oldStatus: ch.status,
    newStatus,
    oldState: ch.evolutionConnectionState,
    newState: state,
    phoneNumber,
    displayName: finalProfileName,
  });

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
        jobId: `channel-sync-${ch.organizationId}-${ch.id}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    logger.info("Channel sync job enqueued", { channelId: ch.id });

    // Disparar job para sync de logo do WhatsApp (só se tiver profilePictureUrl)
    if (finalProfilePictureUrl) {
      await whatsappLogoSyncQueue.add(
        "sync-whatsapp-logo",
        {
          organizationId: ch.organizationId,
          profilePictureUrl: finalProfilePictureUrl,
        },
        {
          jobId: `whatsapp-logo-sync-${ch.organizationId}`,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info("WhatsApp logo sync job enqueued", {
        organizationId: ch.organizationId,
        profilePictureUrl: finalProfilePictureUrl,
      });
    }
  }
}
