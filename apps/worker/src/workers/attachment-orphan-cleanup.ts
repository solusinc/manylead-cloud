import type { Job } from "bullmq";
import { and, attachment, eq, inArray, isNotNull, quickReply } from "@manylead/db";
import { db, organization } from "@manylead/db";
import { storage, extractKeyFromUrl } from "@manylead/storage";
import { logger } from "~/libs/utils/logger";
import { tenantManager } from "~/libs/tenant-manager";

/**
 * Attachment orphan cleanup job data schema
 */
export interface AttachmentOrphanCleanupJobData {
  organizationId?: string; // Optional: if not provided, process all orgs
  dryRun?: boolean; // Se true, apenas loga o que seria deletado
}

/**
 * Process attachment orphan cleanup job
 *
 * Limpa arquivos órfãos no R2 que não têm registro no DB
 * e atualiza registros do DB que apontam para arquivos inexistentes no R2
 *
 * Este worker complementa o R2 Lifecycle Policy limpando inconsistências:
 * - Arquivos no R2 sem registro no DB (órfãos)
 * - Registros no DB apontando para arquivos deletados pelo lifecycle
 */
export async function processAttachmentOrphanCleanup(
  job: Job<AttachmentOrphanCleanupJobData>,
): Promise<void> {
  const { organizationId, dryRun = false } = job.data;

  // If no organizationId provided, process all organizations
  if (!organizationId || organizationId === "system") {
    logger.info({ jobId: job.id, dryRun }, "Starting orphan cleanup for all organizations");

    const organizations = await db.select({ id: organization.id }).from(organization);

    logger.info({ count: organizations.length }, "Found organizations to process");

    for (const org of organizations) {
      try {
        await processOrganizationOrphanCleanup(job.id, org.id, dryRun);
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            organizationId: org.id,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to cleanup organization orphans",
        );
        // Continue processing other organizations
      }
    }

    return;
  }

  // Process single organization
  await processOrganizationOrphanCleanup(job.id, organizationId, dryRun);
}

/**
 * Process orphan cleanup for a single organization
 */
async function processOrganizationOrphanCleanup(
  jobId: string | undefined,
  organizationId: string,
  dryRun: boolean,
): Promise<void> {
  logger.info(
    { jobId, organizationId, dryRun },
    "Starting orphan cleanup for organization",
  );

  const tenantDb = await tenantManager.getConnection(organizationId);

  try {
    // 1. Buscar todos os attachments ativos no DB
    const activeAttachments = await tenantDb
      .select({
        id: attachment.id,
        storagePath: attachment.storagePath,
        storageUrl: attachment.storageUrl,
        downloadStatus: attachment.downloadStatus,
      })
      .from(attachment)
      .where(
        and(
          eq(attachment.downloadStatus, "completed"),
          isNotNull(attachment.storagePath),
        ),
      );

    logger.info(
      { count: activeAttachments.length },
      "Found active attachments in DB",
    );

    // 2. Verificar quais arquivos existem no R2
    const orphanedDbRecords: string[] = [];
    const validPaths = new Set<string>();

    for (const att of activeAttachments) {
      if (!att.storagePath) continue;

      try {
        // Verificar se arquivo existe no R2
        const exists = await storage.exists(att.storagePath);

        if (exists) {
          validPaths.add(att.storagePath);
        } else {
          // Arquivo não existe no R2, mas DB aponta para ele
          orphanedDbRecords.push(att.id);
          logger.warn(
            {
              attachmentId: att.id,
              storagePath: att.storagePath,
            },
            "Found orphaned DB record (file missing in R2)",
          );
        }
      } catch (error) {
        logger.error(
          {
            attachmentId: att.id,
            storagePath: att.storagePath,
            error: error instanceof Error ? error.message : String(error),
          },
          "Error checking file existence in R2",
        );
      }
    }

    // 3. Atualizar registros órfãos no DB (arquivos já deletados do R2)
    if (orphanedDbRecords.length > 0) {
      if (dryRun) {
        logger.info(
          { count: orphanedDbRecords.length, ids: orphanedDbRecords },
          "[DRY RUN] Would mark DB records as expired (files missing in R2)",
        );
      } else {
        const updated = await tenantDb
          .update(attachment)
          .set({
            downloadStatus: "expired",
            storageUrl: null,
          })
          .where(inArray(attachment.id, orphanedDbRecords))
          .returning({ id: attachment.id });

        logger.info(
          { count: updated.length },
          "Marked orphaned DB records as expired",
        );
      }
    }

    // 4. Buscar quick replies e adicionar seus paths aos válidos
    const activeQuickReplies = await tenantDb
      .select({
        id: quickReply.id,
        messages: quickReply.messages,
      })
      .from(quickReply)
      .where(eq(quickReply.organizationId, organizationId));

    for (const qr of activeQuickReplies) {
      const messages = qr.messages;
      for (const message of messages) {
        if (message.mediaUrl?.startsWith("http")) {
          const key = extractKeyFromUrl(message.mediaUrl);
          if (key) {
            validPaths.add(key);
          }
        }
      }
    }

    logger.info(
      { count: activeQuickReplies.length },
      "Found quick replies in tenant DB",
    );

    // 5. Buscar logo da organização e adicionar aos paths válidos
    const [orgData] = await db
      .select({ logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (orgData?.logo) {
      const key = extractKeyFromUrl(orgData.logo);
      if (key) {
        validPaths.add(key);
        logger.debug({ key }, "Added organization logo to valid paths");
      }
    }

    logger.info(
      { totalValidPaths: validPaths.size },
      "Total valid paths from all sources (attachments, quick replies, logos)",
    );

    // 6. Buscar arquivos órfãos no R2 (arquivos sem registro em NENHUMA tabela)
    // Listar arquivos no prefixo da organização
    const orgPrefix = `${organizationId}/`;
    const r2Objects = await storage.list(orgPrefix);

    const orphanedR2Files: string[] = [];

    for (const obj of r2Objects) {
      if (!obj.key) continue;

      // Se arquivo não está no Set de paths válidos de NENHUMA fonte, é órfão
      if (!validPaths.has(obj.key)) {
        orphanedR2Files.push(obj.key);
        logger.warn(
          {
            key: obj.key,
            size: obj.size,
          },
          "Found orphaned R2 file (no reference in any table)",
        );
      }
    }

    // 7. Deletar arquivos órfãos do R2
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

    // 8. Summary
    logger.info(
      {
        jobId,
        organizationId,
        dryRun,
        summary: {
          totalActiveAttachments: activeAttachments.length,
          totalQuickReplies: activeQuickReplies.length,
          totalValidPaths: validPaths.size,
          orphanedDbRecords: orphanedDbRecords.length,
          orphanedR2Files: orphanedR2Files.length,
        },
      },
      "Attachment orphan cleanup completed successfully (validated all sources)",
    );
  } catch (error) {
    logger.error(
      {
        jobId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Attachment orphan cleanup failed",
    );

    throw error;
  }
}
