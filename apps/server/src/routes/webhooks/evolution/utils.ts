import { channel, db as catalogDb, organization } from "@manylead/db";
import { eq } from "@manylead/db";

import { tenantManager } from "~/libs/tenant-manager";

/**
 * Utilities para webhook handlers
 */

/**
 * Extrai slug da organização do instanceName e busca o UUID
 *
 * Format: manylead_{slug}
 */
export async function extractOrganizationId(instanceName: string): Promise<string | null> {
  const parts = instanceName.split("_");

  if (parts.length < 2 || parts[0] !== "manylead") {
    console.warn(`[Utils] Formato de instanceName inválido: ${instanceName}`);
    return null;
  }

  const slug = parts[1];

  if (!slug) {
    return null;
  }

  // Buscar organização pelo slug no catalog
  try {
    const [org] = await catalogDb
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);

    return org?.id ?? null;
  } catch (error) {
    console.error(`[Utils] Erro ao buscar organização pelo slug ${slug}:`, error);
    return null;
  }
}

/**
 * Busca canal pelo evolutionInstanceName
 *
 * @returns Canal encontrado ou null
 */
export async function findChannelByInstanceName(instanceName: string) {
  const organizationId = await extractOrganizationId(instanceName);

  if (!organizationId) {
    return null;
  }

  try {
    const tenantDb = await tenantManager.getConnection(organizationId);

    const [ch] = await tenantDb
      .select()
      .from(channel)
      .where(eq(channel.evolutionInstanceName, instanceName))
      .limit(1);

    return ch ?? null;
  } catch (error) {
    console.error(`[Utils] Erro ao buscar canal:`, error);
    return null;
  }
}

/**
 * Logger estruturado para webhooks
 */
export class WebhookLogger {
  private prefix: string;

  constructor(event: string, instanceName: string) {
    this.prefix = `[Webhook:${event}:${instanceName}]`;
  }

  info(message: string, data?: unknown) {
    console.log(this.prefix, message, data ? JSON.stringify(data) : "");
  }

  warn(message: string, data?: unknown) {
    console.warn(this.prefix, message, data ? JSON.stringify(data) : "");
  }

  error(message: string, error?: unknown) {
    console.error(this.prefix, message, error);
  }
}
