import type { Job } from "bullmq";
import { and, channel, CHANNEL_TYPE, db, eq, organization, organizationSettings } from "@manylead/db";
import { getBrightDataClient } from "@manylead/bright-data";
import { EvolutionAPIClient } from "@manylead/evolution-api-client";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Proxy Keep-Alive job data schema
 */
export interface ProxyKeepAliveJobData {
  organizationId: string;
}

/**
 * Process proxy keep-alive job
 *
 * Maintains Bright Data sticky sessions for ALL organizations with proxy enabled.
 * - Checks if keep-alive is needed (every 5 minutes)
 * - Makes light request via Evolution API to keep session alive
 * - Updates lastKeepAliveAt timestamp
 * - Rotates IP automatically on 502 errors from Bright Data
 */
export async function processProxyKeepAlive(
  job: Job<ProxyKeepAliveJobData>
): Promise<void> {
  const { organizationId: triggerOrg } = job.data;

  logger.info(
    { jobId: job.id, trigger: triggerOrg },
    "Starting proxy keep-alive check for all organizations"
  );

  try {
    const startTime = Date.now();

    // 1. Buscar todas as organizações do catalog DB
    // TODO: Otimizar - cachear lista de orgs com proxy enabled no Redis
    const allOrganizations = await db
      .select({ id: organization.id })
      .from(organization);

    logger.info(
      { jobId: job.id, organizationCount: allOrganizations.length },
      "Found organizations to check for proxy keep-alive"
    );

    let processedCount = 0;
    let skippedCount = 0;

    // 2. Processar cada organização
    for (const org of allOrganizations) {
      const organizationId = org.id;
      try {
        const result = await processOrganizationKeepAlive(job.id ?? "unknown", organizationId);
        if (result.processed) {
          processedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        // Log error but continue processing other orgs
        logger.error(
          { jobId: job.id, organizationId, error },
          "Failed to process proxy keep-alive for organization, continuing with others"
        );
        skippedCount++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      {
        jobId: job.id,
        totalOrgs: allOrganizations.length,
        processed: processedCount,
        skipped: skippedCount,
        durationMs: duration,
      },
      "Proxy keep-alive check completed for all organizations"
    );
  } catch (error) {
    logger.error(
      { jobId: job.id, error },
      "Proxy keep-alive job failed"
    );

    throw error;
  }
}

/**
 * Process proxy keep-alive for a single organization
 */
async function processOrganizationKeepAlive(
  jobId: string,
  organizationId: string
): Promise<{ processed: boolean }> {
  try {
    // Get tenant database connection
    const tenantDb = await tenantManager.getConnection(organizationId);

    // 1. Buscar organization settings
    const [orgSettings] = await tenantDb
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (!orgSettings?.proxySettings?.enabled) {
      return { processed: false };
    }

    // 2. Verificar se tem channel Evolution API ativo (QR_CODE)
    // ⚠️ Proxy APENAS para Evolution API, NÃO para WhatsApp Business API
    const [activeChannel] = await tenantDb
      .select()
      .from(channel)
      .where(
        and(
          eq(channel.organizationId, organizationId),
          eq(channel.channelType, CHANNEL_TYPE.QR_CODE),
          eq(channel.status, "connected"),
          eq(channel.isActive, true)
        )
      )
      .limit(1);

    if (!activeChannel) {
      return { processed: false };
    }

    // 3. Verificar se precisa keep-alive (5 min desde último)
    const brightData = getBrightDataClient();
    const needsKeepAlive = brightData.needsKeepAlive(
      orgSettings.proxySettings.lastKeepAliveAt
    );

    if (!needsKeepAlive) {
      return { processed: false };
    }

    // 4. Fazer request leve via Evolution API (instance.fetch)
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    if (!apiUrl || !apiKey) {
      throw new Error("EVOLUTION_API_URL and EVOLUTION_API_KEY must be set");
    }

    const evolutionClient = new EvolutionAPIClient(apiUrl, apiKey);

    try {
      // Fazer fetch da instância para manter sessão ativa
      await evolutionClient.instance.fetch(activeChannel.evolutionInstanceName);

      // Registrar health check bem-sucedido
      brightData.recordHealthCheck(organizationId, true);

      // 5. Atualizar lastKeepAliveAt no DB
      await tenantDb
        .update(organizationSettings)
        .set({
          proxySettings: {
            ...orgSettings.proxySettings,
            lastKeepAliveAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.organizationId, organizationId));

      logger.info(
        { jobId, organizationId, instanceName: activeChannel.evolutionInstanceName },
        "Proxy keep-alive completed successfully"
      );

      return { processed: true };
    } catch (error) {
      // 6. Se erro 502: rotacionar IP automaticamente
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is502Error =
        errorMessage.includes("502") ||
        errorMessage.includes("Bad Gateway") ||
        errorMessage.includes("Proxy Error");

      if (is502Error) {
        logger.warn(
          { organizationId, error: errorMessage },
          "Detected 502 error from Bright Data, rotating proxy IP"
        );

        // Rotacionar IP
        const { config: newProxyConfig, newSessionId, rotationCount } =
          brightData.rotateProxy(
            organizationId,
            orgSettings.proxySettings,
            orgSettings.timezone
          );

        // Aplicar novo proxy na Evolution API
        await evolutionClient.proxy.set(
          activeChannel.evolutionInstanceName,
          newProxyConfig
        );

        // Atualizar DB com novo sessionId e rotationCount
        await tenantDb
          .update(organizationSettings)
          .set({
            proxySettings: {
              ...orgSettings.proxySettings,
              sessionId: newSessionId,
              rotationCount,
              lastRotatedAt: new Date().toISOString(),
              lastKeepAliveAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(organizationSettings.organizationId, organizationId));

        logger.info(
          { organizationId, newSessionId, rotationCount },
          "Proxy IP rotated successfully after 502 error"
        );

        // Registrar health check com falha
        brightData.recordHealthCheck(organizationId, false, errorMessage);

        // IP rotacionado com sucesso
        return { processed: true };
      } else {
        // Outro tipo de erro - apenas registrar
        brightData.recordHealthCheck(organizationId, false, errorMessage);

        logger.error(
          { jobId, organizationId, error: errorMessage },
          "Proxy keep-alive failed with non-502 error"
        );

        throw error;
      }
    }
  } catch (error) {
    logger.error(
      { jobId, organizationId, error },
      "Failed to process proxy keep-alive for organization"
    );

    throw error;
  }
}
