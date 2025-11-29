import type { Job } from "bullmq";
import { and, attachment, eq, lte, sql } from "@manylead/db";
import { db, organization } from "@manylead/db";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Attachment cleanup job data schema
 */
export interface AttachmentCleanupJobData {
  organizationId?: string; // Optional: if not provided, process all orgs
}

/**
 * Process attachment cleanup job
 *
 * Marca attachments como expirados baseado no R2 lifecycle policies:
 * - Videos: 48 horas
 * - Imagens/Audio/Documentos: 90 dias
 *
 * IMPORTANTE: Não deleta os arquivos do R2! O R2 Lifecycle Policy faz isso automaticamente.
 * Este worker apenas atualiza o status no banco de dados para "expired".
 */
export async function processAttachmentCleanup(
  job: Job<AttachmentCleanupJobData>,
): Promise<void> {
  const { organizationId } = job.data;

  // If no organizationId provided, process all organizations
  if (!organizationId || organizationId === "system") {
    logger.info({ jobId: job.id }, "Starting attachment cleanup for all organizations");

    const organizations = await db.select({ id: organization.id }).from(organization);

    logger.info({ count: organizations.length }, "Found organizations to process");

    for (const org of organizations) {
      try {
        await processOrganizationCleanup(job.id, org.id);
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            organizationId: org.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to cleanup organization",
        );
        // Continue processing other organizations
      }
    }

    return;
  }

  // Process single organization
  await processOrganizationCleanup(job.id, organizationId);
}

/**
 * Process cleanup for a single organization
 */
async function processOrganizationCleanup(
  jobId: string | undefined,
  organizationId: string,
): Promise<void> {
  logger.info({ jobId, organizationId }, "Starting attachment cleanup for organization");

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // Calcular timestamps de expiração
    const now = new Date();
    const videoExpirationDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 horas atrás
    const mediaExpirationDate = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000,
    ); // 90 dias atrás

    logger.debug(
      {
        videoExpirationDate: videoExpirationDate.toISOString(),
        mediaExpirationDate: mediaExpirationDate.toISOString(),
      },
      "Calculated expiration dates",
    );

    // Marcar vídeos expirados (48 horas)
    const expiredVideosResult = await tenantDb
      .update(attachment)
      .set({
        downloadStatus: "expired",
        storageUrl: null, // Remove URL pois arquivo não existe mais no R2
      })
      .where(
        and(
          eq(attachment.mediaType, "video"),
          eq(attachment.downloadStatus, "completed"),
          lte(attachment.downloadedAt, videoExpirationDate),
        ),
      )
      .returning({ id: attachment.id });

    const expiredVideosCount = expiredVideosResult.length;

    logger.info(
      { organizationId, count: expiredVideosCount },
      "Marked expired videos",
    );

    // Marcar outras mídias expiradas (90 dias)
    const expiredMediaResult = await tenantDb
      .update(attachment)
      .set({
        downloadStatus: "expired",
        storageUrl: null, // Remove URL pois arquivo não existe mais no R2
      })
      .where(
        and(
          sql`${attachment.mediaType} IN ('image', 'audio', 'document')`,
          eq(attachment.downloadStatus, "completed"),
          lte(attachment.downloadedAt, mediaExpirationDate),
        ),
      )
      .returning({ id: attachment.id });

    const expiredMediaCount = expiredMediaResult.length;

    logger.info(
      { organizationId, count: expiredMediaCount },
      "Marked expired media (images, audio, documents)",
    );

    logger.info(
      {
        jobId,
        organizationId,
        totalExpired: expiredVideosCount + expiredMediaCount,
        expiredVideos: expiredVideosCount,
        expiredMedia: expiredMediaCount,
      },
      "Attachment cleanup completed successfully",
    );
  } catch (error) {
    logger.error(
      {
        jobId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Attachment cleanup failed",
    );

    throw error;
  }
}
