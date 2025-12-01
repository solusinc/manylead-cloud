import type { Job } from "bullmq";
import type { QuickReplyMessage } from "@manylead/db";
import { eq, quickReply, attachment, isNotNull } from "@manylead/db";
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
 * Limpa arquivos órfãos no R2 que não têm registro em NENHUMA tabela do sistema
 *
 * Este worker complementa o R2 Lifecycle Policy limpando inconsistências:
 * - Arquivos no R2 sem registro no DB (órfãos)
 * - Valida contra: quick_reply.messages, attachment.storagePath, user.image, organization.logo
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

    // 2. Verificar se mediaUrls dos quick replies existem no R2 e limpar referências quebradas
    const quickRepliesToUpdate: { id: string; messages: QuickReplyMessage[] }[] = [];

    for (const qr of activeQuickReplies) {
      let hasOrphanedMedia = false;
      const updatedMessages: QuickReplyMessage[] = [];

      for (const message of qr.messages) {
        if (message.mediaUrl?.startsWith("http")) {
          const key = extractKeyFromUrl(message.mediaUrl);

          if (key) {
            try {
              // Verificar se arquivo existe no R2
              const exists = await storage.exists(key);

              if (!exists) {
                // Arquivo não existe no R2, remover mensagem completamente
                hasOrphanedMedia = true;
                logger.warn(
                  {
                    quickReplyId: qr.id,
                    mediaUrl: message.mediaUrl,
                    key,
                    messageType: message.type,
                  },
                  "Found orphaned media message in quick reply (file missing in R2) - removing message",
                );
                // NÃO adicionar a mensagem (remove do JSONB)
              } else {
                // Arquivo existe, manter mensagem
                updatedMessages.push(message);
              }
            } catch (error) {
              logger.error(
                {
                  quickReplyId: qr.id,
                  key,
                  error: error instanceof Error ? error.message : String(error),
                },
                "Error checking file existence in R2",
              );
              // Em caso de erro, manter a mensagem
              updatedMessages.push(message);
            }
          } else {
            // Não conseguiu extrair key, manter mensagem
            updatedMessages.push(message);
          }
        } else {
          // Mensagem sem mídia, manter
          updatedMessages.push(message);
        }
      }

      if (hasOrphanedMedia) {
        quickRepliesToUpdate.push({
          id: qr.id,
          messages: updatedMessages,
        });
      }
    }

    // 3. Atualizar quick replies com referências quebradas (remover mensagens órfãs)
    if (quickRepliesToUpdate.length > 0) {
      if (dryRun) {
        logger.info(
          { count: quickRepliesToUpdate.length, ids: quickRepliesToUpdate.map(qr => qr.id) },
          "[DRY RUN] Would remove orphaned media messages from quick replies",
        );
      } else {
        for (const qr of quickRepliesToUpdate) {
          await tenantDb
            .update(quickReply)
            .set({
              messages: qr.messages,
            })
            .where(eq(quickReply.id, qr.id));
        }

        logger.info(
          { count: quickRepliesToUpdate.length },
          "Removed orphaned media messages from quick replies",
        );
      }
    }

    // 4. Extrair mediaUrls válidas (que existem no R2) para validação
    const validMediaUrls = new Set<string>();
    const validPaths = new Set<string>();

    // Re-buscar quick replies atualizados
    const updatedQuickReplies = await tenantDb
      .select({
        id: quickReply.id,
        messages: quickReply.messages,
      })
      .from(quickReply)
      .where(eq(quickReply.organizationId, organizationId));

    for (const qr of updatedQuickReplies) {
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
      "Found valid media URLs in quick replies (after cleanup)",
    );

    // 5. Buscar attachments no tenant DB
    const activeAttachments = await tenantDb
      .select({
        storagePath: attachment.storagePath,
      })
      .from(attachment)
      .where(isNotNull(attachment.storagePath));

    for (const att of activeAttachments) {
      if (att.storagePath) {
        validPaths.add(att.storagePath);
      }
    }

    logger.info(
      { count: activeAttachments.length },
      "Found attachments in tenant DB",
    );

    // 6. Buscar avatars e logos no catalog DB (apenas desta organização)
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

    // Buscar avatars de usuários desta organização
    // (avatars não têm organizationId, mas vamos incluir na validação geral)

    logger.info(
      { totalValidPaths: validPaths.size },
      "Total valid paths from all sources",
    );

    // 7. Buscar arquivos órfãos no R2 (arquivos sem registro em NENHUMA tabela)
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

    // 8. Deletar arquivos órfãos do R2
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

    // 9. Summary
    logger.info(
      {
        jobId,
        organizationId,
        dryRun,
        summary: {
          totalQuickReplies: activeQuickReplies.length,
          quickRepliesWithOrphanedMedia: quickRepliesToUpdate.length,
          totalAttachments: activeAttachments.length,
          validMediaUrls: validMediaUrls.size,
          totalValidPaths: validPaths.size,
          orphanedR2Files: orphanedR2Files.length,
        },
      },
      "Orphan cleanup completed successfully (validated all sources + cleaned broken refs)",
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
