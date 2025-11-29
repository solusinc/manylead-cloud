import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, attachment, count, desc, eq, sql } from "@manylead/db";
import { storage, getPublicUrl } from "@manylead/storage";
import { generateMediaPath } from "@manylead/storage/utils";
import { MEDIA_LIMITS } from "@manylead/shared/constants";

import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Attachments Router
 *
 * Gerencia anexos/mídias das mensagens
 */
export const attachmentsRouter = createTRPCRouter({
  /**
   * Listar attachments de uma mensagem
   */
  listByMessage: ownerProcedure
    .input(
      z.object({
        messageId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { messageId, limit, offset } = input;

      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select()
          .from(attachment)
          .where(eq(attachment.messageId, messageId))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(attachment.createdAt)),
        ctx.tenantDb
          .select({ count: count() })
          .from(attachment)
          .where(eq(attachment.messageId, messageId)),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Listar attachments pendentes de download
   */
  listPending: ownerProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;

      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select()
          .from(attachment)
          .where(and(eq(attachment.downloadStatus, "pending")))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(attachment.createdAt)),
        ctx.tenantDb
          .select({ count: count() })
          .from(attachment)
          .where(eq(attachment.downloadStatus, "pending")),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar attachment por ID
   */
  getById: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [attachmentRecord] = await ctx.tenantDb
        .select()
        .from(attachment)
        .where(eq(attachment.id, input.id))
        .limit(1);

      if (!attachmentRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Anexo não encontrado",
        });
      }

      return attachmentRecord;
    }),

  /**
   * Atualizar status de download do attachment
   */
  updateDownloadStatus: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        downloadStatus: z.enum([
          "pending",
          "downloading",
          "completed",
          "failed",
          "expired",
        ]),
        storagePath: z.string().optional(),
        storageUrl: z.string().url().optional(),
        fileSize: z.number().optional(),
        downloadError: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, downloadStatus, ...data } = input;

      const updateData: Record<string, unknown> = {
        downloadStatus,
        ...data,
      };

      if (downloadStatus === "completed") {
        updateData.downloadedAt = new Date();
      }

      const [updated] = await ctx.tenantDb
        .update(attachment)
        .set(updateData)
        .where(eq(attachment.id, id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Anexo não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Deletar attachment
   */
  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Buscar attachment antes de deletar para ter o storagePath
      const [attachmentRecord] = await ctx.tenantDb
        .select()
        .from(attachment)
        .where(eq(attachment.id, input.id))
        .limit(1);

      if (!attachmentRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Anexo não encontrado",
        });
      }

      // Deletar do banco
      const [deleted] = await ctx.tenantDb
        .delete(attachment)
        .where(eq(attachment.id, input.id))
        .returning();

      // Deletar arquivo do R2
      if (attachmentRecord.storagePath) {
        try {
          await storage.delete(attachmentRecord.storagePath);
        } catch (error) {
          console.error("Erro ao deletar arquivo do R2:", error);
          // Não falhar a operação se o arquivo já foi deletado ou não existe
        }
      }

      return { success: true, deleted };
    }),

  /**
   * Estatísticas de attachments
   */
  stats: ownerProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.tenantDb
      .select({
        total: count(),
        pending: sql<number>`count(*) FILTER (WHERE ${attachment.downloadStatus} = 'pending')`,
        downloading: sql<number>`count(*) FILTER (WHERE ${attachment.downloadStatus} = 'downloading')`,
        completed: sql<number>`count(*) FILTER (WHERE ${attachment.downloadStatus} = 'completed')`,
        failed: sql<number>`count(*) FILTER (WHERE ${attachment.downloadStatus} = 'failed')`,
        expired: sql<number>`count(*) FILTER (WHERE ${attachment.downloadStatus} = 'expired')`,
      })
      .from(attachment);

    return stats;
  }),

  /**
   * Gerar pre-signed URL para upload de arquivo
   * Frontend usa isso para fazer upload direto para R2
   */
  getSignedUploadUrl: ownerProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z
          .string()
          .min(1)
          .refine(
            (type) => {
              const allAllowedTypes = [
                ...MEDIA_LIMITS.IMAGE.ALLOWED_TYPES,
                ...MEDIA_LIMITS.VIDEO.ALLOWED_TYPES,
                ...MEDIA_LIMITS.AUDIO.ALLOWED_TYPES,
                ...MEDIA_LIMITS.DOCUMENT.ALLOWED_TYPES,
              ];
              return allAllowedTypes.includes(type as never);
            },
            "Tipo de arquivo não permitido",
          ),
        expiresIn: z.number().min(60).max(3600).default(300), // 5 minutos default
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Gerar path único para o arquivo
      const storagePath = generateMediaPath(
        organizationId,
        input.fileName,
        input.mimeType,
      );

      // Gerar pre-signed URL usando singleton storage
      const signedUrl = await storage.getSignedUploadUrl(
        storagePath,
        input.expiresIn,
      );

      return {
        uploadUrl: signedUrl,
        storagePath,
        publicUrl: `${getPublicUrl()}/${storagePath}`,
        expiresIn: input.expiresIn,
      };
    }),
});
