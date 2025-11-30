import type { Job } from "bullmq";
import { eq, quickReply } from "@manylead/db";
import { db, organization } from "@manylead/db";
import { extractKeyFromUrl, storage } from "@manylead/storage";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Quick Reply orphan cleanup job data schema
 */
export interface QuickReplyOrphanCleanupJobData {
  organizationId?: string; // Optional: if not provided, process all orgs
  dryRun?: boolean; // Se true, apenas loga o que seria deletado
}

/**
 * Process quick reply orphan cleanup job
 *
 * Limpa arquivos órfãos no R2 que não têm registro no DB (quick_reply.messages JSONB)
 *
 * Este worker complementa o R2 Lifecycle Policy limpando inconsistências:
 * - Arquivos no R2 sem registro no DB (órfãos)
 * - Arquivos de quick replies deletados
 */
export async function processQuickReplyOrphanCleanup(
  job: Job<QuickReplyOrphanCleanupJobData>,
): Promise<void> {
  const { organizationId, dryRun = false } = job.data;

  // If no organizationId provided, process all organizations
  if (!organizationId || organizationId === "system") {
    logger.info({ jobId: job.id, dryRun }, "Starting quick reply orphan cleanup for all organizations");

    const organizations = await db.select({ id: organization.id }).from(organization);

    logger.info({ count: organizations.length }, "Found organizations to process");

    for (const org of organizations) {
      try {
        await processOrganizationQuickReplyOrphanCleanup(job.id, org.id, dryRun);
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            organizationId: org.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to cleanup organization quick reply orphans",
        );
        // Continue processing other organizations
      }
    }

    return;
  }

  // Process single organization
  await processOrganizationQuickReplyOrphanCleanup(job.id, organizationId, dryRun);
}

/**
 * Process quick reply orphan cleanup for a single organization
 */
async function processOrganizationQuickReplyOrphanCleanup(
  jobId: string | undefined,
  organizationId: string,
  dryRun: boolean,
): Promise<void> {
  logger.info(
    { jobId, organizationId, dryRun },
    "Starting quick reply orphan cleanup for organization",
  );

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // 1. Buscar todos os quick replies ativos no DB
    const activeQuickReplies = await tenantDb
      .select({
        id: quickReply.id,
        messages: quickReply.messages,
      })
      .from(quickReply)
      .where(eq(quickReply.organizationId, organizationId));

    logger.info(
      { count: activeQuickReplies.length },
      "Found quick replies in DB",
    );

    // 2. Extrair todas as mediaUrls dos quick replies
    const validMediaUrls = new Set<string>();
    const validPaths = new Set<string>();

    for (const qr of activeQuickReplies) {
      const messages = qr.messages;

      for (const message of messages) {
        if (message.mediaUrl?.startsWith("http")) {
          validMediaUrls.add(message.mediaUrl);

          // Extrair o storage key da URL
          const key = extractKeyFromUrl(message.mediaUrl);
          if (key) {
            validPaths.add(key);
          }
        }
      }
    }

    logger.info(
      { count: validPaths.size },
      "Found valid media URLs in quick replies",
    );

    // 3. Buscar arquivos órfãos no R2 (arquivos sem registro no DB)
    // Listar arquivos no prefixo da organização
    const orgPrefix = `${organizationId}/`;
    const r2Objects = await storage.list(orgPrefix);

    const orphanedR2Files: string[] = [];

    for (const obj of r2Objects) {
      if (!obj.key) continue;

      // Se arquivo não está no Set de paths válidos, é órfão
      if (!validPaths.has(obj.key)) {
        orphanedR2Files.push(obj.key);
        logger.warn(
          {
            key: obj.key,
            size: obj.size,
          },
          "Found orphaned R2 file (no quick reply reference)",
        );
      }
    }

    // 4. Deletar arquivos órfãos do R2
    if (orphanedR2Files.length > 0) {
      if (dryRun) {
        logger.info(
          {
            count: orphanedR2Files.length,
            files: orphanedR2Files.slice(0, 10), // Log apenas primeiros 10
          },
          "[DRY RUN] Would delete orphaned R2 files",
        );
      } else {
        let deletedCount = 0;
        let failedCount = 0;

        for (const key of orphanedR2Files) {
          try {
            await storage.delete(key);
            deletedCount++;
            logger.debug({ key }, "Deleted orphaned R2 file");
          } catch (error) {
            failedCount++;
            logger.error(
              {
                key,
                error: error instanceof Error ? error.message : String(error),
              },
              "Failed to delete orphaned R2 file",
            );
          }
        }

        logger.info(
          { deletedCount, failedCount, total: orphanedR2Files.length },
          "Deleted orphaned R2 files",
        );
      }
    }

    // 5. Summary
    logger.info(
      {
        jobId,
        organizationId,
        dryRun,
        summary: {
          totalQuickReplies: activeQuickReplies.length,
          validMediaUrls: validMediaUrls.size,
          orphanedR2Files: orphanedR2Files.length,
        },
      },
      "Quick reply orphan cleanup completed successfully",
    );
  } catch (error) {
    logger.error(
      {
        jobId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Quick reply orphan cleanup failed",
    );

    throw error;
  }
}
