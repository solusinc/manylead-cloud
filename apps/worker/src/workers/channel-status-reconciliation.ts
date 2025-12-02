import type { Job } from "bullmq";
import { channel, db as catalogDb, eq, tenant } from "@manylead/db";
import { evolutionAPI } from "@manylead/evolution-api-client";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";
import { eventPublisher } from "~/libs/cache/event-publisher";

/**
 * Channel status reconciliation job data schema
 * Empty - processes all active channels
 */
export type ChannelStatusReconciliationJobData = Record<string, never>;

/**
 * Process channel status reconciliation job
 *
 * Verifica o status de todos os canais ativos na Evolution API
 * e sincroniza com o banco de dados caso haja divergência
 */
export async function processChannelStatusReconciliation(
  job: Job<ChannelStatusReconciliationJobData>
): Promise<void> {
  logger.info(
    { jobId: job.id },
    "Starting channel status reconciliation"
  );

  try {
    // 1. Buscar todos os tenants
    const tenants = await catalogDb.select().from(tenant);

    logger.info({ tenantCount: tenants.length }, "Found tenants to reconcile");

    let totalChannelsChecked = 0;
    let totalChannelsReconciled = 0;
    let totalErrors = 0;

    for (const t of tenants) {
      try {
        const tenantDb = await tenantManager.getConnection(t.organizationId);

        // 2. Buscar canais ativos com instância Evolution
        const channels = await tenantDb
          .select()
          .from(channel)
          .where(eq(channel.isActive, true));

        const evolutionChannels = channels.filter((ch) => ch.evolutionInstanceName);

        logger.info(
          {
            tenantId: t.id,
            tenantName: t.name,
            evolutionChannels: evolutionChannels.length,
          },
          "Processing tenant channels for reconciliation"
        );

        for (const ch of evolutionChannels) {
          if (!ch.evolutionInstanceName) continue;

          totalChannelsChecked++;

          try {
            // 3. Buscar status real na Evolution API
            const instanceData = await evolutionAPI.instance.fetch(
              ch.evolutionInstanceName
            );

            // Evolution API retorna um array
            const instance = Array.isArray(instanceData) ? instanceData[0] : instanceData;
            const realState = instance?.connectionStatus ?? instance?.state;

            if (!realState) {
              logger.warn(
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
            const expectedStatus = mapStateToStatus(realState);

            // 5. Detectar dessincronização
            if (
              ch.status !== expectedStatus ||
              ch.evolutionConnectionState !== realState
            ) {
              logger.warn(
                {
                  channelId: ch.id,
                  instanceName: ch.evolutionInstanceName,
                  dbStatus: ch.status,
                  dbState: ch.evolutionConnectionState,
                  realState,
                  expectedStatus,
                },
                "Detected status mismatch - reconciling"
              );

              // 6. Atualizar banco
              await tenantDb
                .update(channel)
                .set({
                  status: expectedStatus,
                  evolutionConnectionState: realState,
                  updatedAt: new Date(),
                })
                .where(eq(channel.id, ch.id));

              // 7. Publicar evento via Redis Pub/Sub (será encaminhado para Socket.io pelo servidor)
              try {
                await eventPublisher.publish("channel:sync", {
                  type: "channel:status:reconciled",
                  organizationId: ch.organizationId,
                  channelId: ch.id,
                  data: {
                    status: expectedStatus,
                    connectionState: realState,
                    oldStatus: ch.status,
                    oldState: ch.evolutionConnectionState,
                  },
                });
              } catch (publishError) {
                logger.warn(
                  {
                    channelId: ch.id,
                    error: publishError instanceof Error ? publishError.message : String(publishError),
                  },
                  "Failed to publish reconciliation event"
                );
              }

              totalChannelsReconciled++;

              logger.info(
                {
                  channelId: ch.id,
                  instanceName: ch.evolutionInstanceName,
                  oldStatus: ch.status,
                  newStatus: expectedStatus,
                  oldState: ch.evolutionConnectionState,
                  newState: realState,
                },
                "Channel status reconciled successfully"
              );
            }
          } catch (error) {
            totalErrors++;
            logger.warn(
              {
                channelId: ch.id,
                instanceName: ch.evolutionInstanceName,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to reconcile channel"
            );
          }
        }
      } catch (error) {
        totalErrors++;
        logger.error(
          {
            tenantId: t.id,
            tenantName: t.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to process tenant for reconciliation"
        );
      }
    }

    logger.info(
      {
        jobId: job.id,
        totalChannelsChecked,
        totalChannelsReconciled,
        totalErrors,
      },
      "Channel status reconciliation completed"
    );
  } catch (error) {
    logger.error(
      {
        jobId: job.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "Channel status reconciliation failed"
    );

    throw error;
  }
}

/**
 * Map Evolution API state to system status
 */
function mapStateToStatus(state: string): string {
  switch (state) {
    case "open":
      return "connected";
    case "close":
      return "disconnected";
    case "connecting":
      return "pending";
    default:
      logger.warn({ state }, "Unknown Evolution state in reconciliation");
      return "pending";
  }
}
