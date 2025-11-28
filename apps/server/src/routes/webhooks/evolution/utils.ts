import { channel, db as catalogDb, organization } from "@manylead/db";
import { eq } from "@manylead/db";

import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("WebhookUtils");

/**
 * Utilities para webhook handlers
 */

/**
 * Extrai slug da organização do instanceName e busca o UUID
 *
 * Format: {slug}
 */
export async function extractOrganizationId(instanceName: string): Promise<string | null> {
  // O instanceName agora é apenas o slug da organização
  const slug = instanceName;

  if (!slug) {
    log.warn("Empty instanceName");
    return null;
  }

  // Buscar organização pelo slug no catalog
  try {
    const [org] = await catalogDb
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);

    if (!org) {
      log.warn({ slug }, "Organization not found for slug");
      return null;
    }

    return org.id;
  } catch (error) {
    log.error({ err: error, slug }, "Error fetching organization by slug");
    return null;
  }
}

/**
 * Busca canal pelo evolutionInstanceName
 *
 * @returns Canal encontrado ou null
 */
export async function findChannelByInstanceName(instanceName: string) {
  log.info({ instanceName }, "Searching for channel by instanceName");

  const organizationId = await extractOrganizationId(instanceName);

  if (!organizationId) {
    log.info({ instanceName }, "organizationId not found for instanceName");
    return null;
  }

  log.info({ organizationId }, "organizationId found");

  try {
    const tenantDb = await tenantManager.getConnection(organizationId);

    const [ch] = await tenantDb
      .select()
      .from(channel)
      .where(eq(channel.evolutionInstanceName, instanceName))
      .limit(1);

    log.info(
      { channel: ch ? { id: ch.id, evolutionInstanceName: ch.evolutionInstanceName } : null },
      "Channel found"
    );

    return ch ?? null;
  } catch (error) {
    log.error({ err: error }, "Error fetching channel");
    return null;
  }
}

/**
 * Logger estruturado para webhooks
 */
export class WebhookLogger {
  private logger: ReturnType<typeof createLogger>;

  constructor(event: string, instanceName: string) {
    this.logger = createLogger(`Webhook:${event}`).child({ instanceName });
  }

  info(message: string, data?: unknown) {
    this.logger.info(data ?? {}, message);
  }

  warn(message: string, data?: unknown) {
    this.logger.warn(data ?? {}, message);
  }

  error(message: string, error?: unknown) {
    this.logger.error({ err: error }, message);
  }
}
