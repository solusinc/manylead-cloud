import type { Job } from "bullmq";
import { sql, organization, contact, db } from "@manylead/db";
import { tenantManager } from "~/libs/tenant-manager";
import { createLogger } from "~/libs/utils/logger";
import { eventPublisher } from "~/libs/cache/event-publisher";

const logger = createLogger("Worker:CrossOrgLogoSync");

/**
 * Job data for cross-org logo synchronization
 */
export interface CrossOrgLogoSyncJobData {
  /** Organization ID that updated its logo */
  organizationId: string;
  /** New logo URL */
  logoUrl: string | null;
}

/**
 * Process cross-org logo sync job
 *
 * Quando uma organização atualiza seu logo, este job atualiza
 * todos os contacts em TODAS as outras orgs que representam essa org.
 *
 * Fluxo:
 * 1. Buscar todas as orgs do catalog
 * 2. Para cada org (exceto a source):
 *    - Conectar no tenant db
 *    - Buscar contacts que representam a org source (metadata.targetOrganizationId)
 *    - Atualizar avatar desses contacts
 */
export async function processCrossOrgLogoSync(
  job: Job<CrossOrgLogoSyncJobData>,
): Promise<void> {
  const { organizationId, logoUrl } = job.data;

  logger.info(
    { organizationId, logoUrl },
    "Starting cross-org logo sync",
  );

  try {
    // 1. Buscar todas as organizações do catalog
    const allOrgs = await db
      .select({ id: organization.id })
      .from(organization);

    logger.info(
      { totalOrgs: allOrgs.length, sourceOrgId: organizationId },
      "Found organizations to sync",
    );

    let totalContactsUpdated = 0;

    // 2. Para cada org (exceto a source), atualizar contacts
    for (const org of allOrgs) {
      // Pular a própria org que fez o update
      if (org.id === organizationId) {
        continue;
      }

      try {
        const tenantDb = await tenantManager.getConnection(org.id);

        // Atualizar contacts que representam a org source
        // Usa operador JSONB @> para query performática
        const result = await tenantDb
          .update(contact)
          .set({
            avatar: logoUrl,
            updatedAt: new Date(),
          })
          .where(
            sql`${contact.metadata} @> jsonb_build_object('targetOrganizationId', ${organizationId}::text)`,
          )
          .returning({ id: contact.id });

        const contactsUpdated = result.length;

        if (contactsUpdated === 0) {
          logger.debug(
            { targetOrgId: org.id, sourceOrgId: organizationId },
            "No cross-org contacts found in this org",
          );
          continue;
        }

        totalContactsUpdated += contactsUpdated;

        // Emitir evento socket para atualizar UI em tempo real
        await eventPublisher.publish("chat:events", {
          type: "contact:logo:updated",
          organizationId: org.id,
          data: {
            sourceOrganizationId: organizationId,
            logoUrl,
            contactsUpdated,
          },
        });

        logger.info(
          {
            targetOrgId: org.id,
            sourceOrgId: organizationId,
            contactsUpdated,
          },
          "Updated cross-org contacts in organization",
        );
      } catch (error) {
        // Log erro mas continua processando outras orgs
        logger.error(
          {
            targetOrgId: org.id,
            sourceOrgId: organizationId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to update contacts in organization",
        );
      }
    }

    logger.info(
      {
        organizationId,
        logoUrl,
        totalContactsUpdated,
        totalOrgsProcessed: allOrgs.length - 1, // Excluindo a source org
      },
      "Cross-org logo sync completed",
    );
  } catch (error) {
    logger.error(
      {
        organizationId,
        logoUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to process cross-org logo sync",
    );
    throw error; // Re-throw para BullMQ tentar novamente
  }
}
