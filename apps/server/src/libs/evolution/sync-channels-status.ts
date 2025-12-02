import { channel, db as catalogDb, eq, tenant } from "@manylead/db";
import { evolutionAPI } from "@manylead/evolution-api-client";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("ChannelStatusSync");

/**
 * Sincroniza status de todos os canais ativos com a Evolution API
 *
 * Executado na inicialização do servidor para garantir que o banco de dados
 * esteja sincronizado com o estado real das instâncias da Evolution API
 */
export async function syncAllChannelsStatus(): Promise<void> {
  log.info("Starting channel status synchronization...");

  try {
    // 1. Buscar todos os tenants
    const tenants = await catalogDb.select().from(tenant);

    log.info({ tenantCount: tenants.length }, "Found tenants");

    for (const t of tenants) {
      try {
        const tenantDb = await tenantManager.getConnection(t.organizationId);

        // 2. Buscar canais ativos com instância Evolution
        const channels = await tenantDb
          .select()
          .from(channel)
          .where(eq(channel.isActive, true));

        const evolutionChannels = channels.filter((ch) => ch.evolutionInstanceName);

        log.info(
          {
            tenantId: t.id,
            tenantName: t.name,
            totalChannels: channels.length,
            evolutionChannels: evolutionChannels.length,
          },
          "Processing tenant channels"
        );

        for (const ch of evolutionChannels) {
          if (!ch.evolutionInstanceName) continue;

          try {
            // 3. Buscar status real na Evolution API
            const instanceData = await evolutionAPI.instance.fetch(
              ch.evolutionInstanceName
            );

            // Evolution API retorna um array
            const instance = Array.isArray(instanceData) ? instanceData[0] : instanceData;
            const realState = instance?.connectionStatus ?? instance?.state;

            if (!realState) {
              log.warn(
                {
                  channelId: ch.id,
                  instanceName: ch.evolutionInstanceName,
                  response: JSON.stringify(instanceData),
                },
                "No state found in Evolution API response"
              );
              continue;
            }

            // 4. Mapear para status do sistema
            let newStatus: string;
            switch (realState) {
              case "open":
                newStatus = "connected";
                break;
              case "close":
                newStatus = "disconnected";
                break;
              case "connecting":
                newStatus = "pending";
                break;
              default:
                log.warn(
                  {
                    channelId: ch.id,
                    realState,
                  },
                  "Unknown Evolution state"
                );
                newStatus = ch.status;
            }

            // 5. Atualizar banco se necessário
            if (
              ch.status !== newStatus ||
              ch.evolutionConnectionState !== realState
            ) {
              await tenantDb
                .update(channel)
                .set({
                  status: newStatus,
                  evolutionConnectionState: realState,
                  updatedAt: new Date(),
                })
                .where(eq(channel.id, ch.id));

              log.info(
                {
                  channelId: ch.id,
                  instanceName: ch.evolutionInstanceName,
                  oldStatus: ch.status,
                  newStatus,
                  oldState: ch.evolutionConnectionState,
                  newState: realState,
                },
                "Channel status synchronized"
              );
            } else {
              log.debug(
                {
                  channelId: ch.id,
                  status: ch.status,
                  state: realState,
                },
                "Channel status already in sync"
              );
            }
          } catch (error) {
            log.warn(
              {
                channelId: ch.id,
                instanceName: ch.evolutionInstanceName,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to sync channel status"
            );
          }
        }
      } catch (error) {
        log.error(
          {
            tenantId: t.id,
            tenantName: t.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to process tenant"
        );
      }
    }

    log.info("Channel status synchronization completed successfully");
  } catch (error) {
    log.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "Channel status synchronization failed"
    );
  }
}
