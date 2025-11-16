import { channel, db as catalogDb, organization } from "@manylead/db";
import { eq } from "@manylead/db";

import { tenantManager } from "~/libs/tenant-manager";

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
    console.warn(`[Utils] instanceName vazio`);
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
      console.warn(`[Utils] Organização não encontrada para slug: ${slug}`);
      return null;
    }

    return org.id;
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
  console.log(`[Utils] Buscando canal para instanceName: ${instanceName}`);

  const organizationId = await extractOrganizationId(instanceName);

  if (!organizationId) {
    console.log(`[Utils] organizationId não encontrado para instanceName: ${instanceName}`);
    return null;
  }

  console.log(`[Utils] organizationId encontrado: ${organizationId}`);

  try {
    const tenantDb = await tenantManager.getConnection(organizationId);

    const [ch] = await tenantDb
      .select()
      .from(channel)
      .where(eq(channel.evolutionInstanceName, instanceName))
      .limit(1);

    console.log(`[Utils] Canal encontrado:`, ch ? { id: ch.id, evolutionInstanceName: ch.evolutionInstanceName } : 'null');

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
