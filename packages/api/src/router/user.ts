import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db, eq, user } from "@manylead/db";
import { extractKeyFromUrl, getPublicUrl, storage } from "@manylead/storage";
import { MEDIA_LIMITS } from "@manylead/shared/constants";

import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * User Router
 *
 * Gerencia dados do usuário autenticado
 */
export const userRouter = createTRPCRouter({
  /**
   * Gerar pre-signed URL para upload de avatar
   * Frontend usa isso para fazer upload direto para R2
   */
  getAvatarUploadUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z
          .string()
          .refine(
            (type) => MEDIA_LIMITS.IMAGE.ALLOWED_TYPES.includes(type as never),
            `Tipo de arquivo não permitido. Use: ${MEDIA_LIMITS.IMAGE.ALLOWED_TYPES.join(", ")}`,
          ),
        expiresIn: z.number().min(60).max(3600).default(300), // 5 minutos default
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Gerar path único para o avatar
      // Formato: {organizationId}/avatars/{userId}/{timestamp}{ext}
      const ext = input.fileName.substring(input.fileName.lastIndexOf("."));
      const storagePath = `${activeOrgId}/avatars/${userId}/${Date.now()}${ext}`;

      // Gerar pre-signed URL
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

  /**
   * Atualizar avatar do usuário
   * Chamado após upload direto para R2
   */
  updateAvatar: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url("URL inválida"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Atualizar imagem do usuário no banco
      const [updated] = await db
        .update(user)
        .set({
          image: input.imageUrl,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      return {
        success: true,
        imageUrl: updated.image,
      };
    }),

  /**
   * Remover avatar do usuário
   */
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    // Buscar imagem atual para deletar do R2
    const [currentUser] = await db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // Deletar do R2 se existir
    if (currentUser?.image) {
      const key = extractKeyFromUrl(currentUser.image);
      if (key) {
        try {
          await storage.delete(key);
        } catch (error) {
          console.error("Erro ao deletar avatar do R2:", error);
        }
      }
    }

    // Remover imagem do usuário no banco
    const [updated] = await db
      .update(user)
      .set({
        image: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Usuário não encontrado",
      });
    }

    return {
      success: true,
    };
  }),
});
