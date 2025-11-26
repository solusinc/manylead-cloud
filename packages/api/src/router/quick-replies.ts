import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  desc,
  eq,
  ilike,
  insertQuickReplySchema,
  or,
  quickReply,
  selectQuickReplySchema,
  sql,
  updateQuickReplySchema,
  type QuickReplyMessage,
} from "@manylead/db";

/**
 * Extrai o conteúdo de preview da primeira mensagem de texto
 */
function getContentPreview(messages: QuickReplyMessage[]): string {
  const firstTextMessage = messages.find((m) => m.type === "text");
  return firstTextMessage?.content ?? "";
}

import { createTRPCRouter, memberProcedure, ownerProcedure, tenantManager } from "../trpc";

/**
 * Quick Replies Router
 *
 * Gerencia respostas rápidas para agilizar o atendimento
 */
export const quickRepliesRouter = createTRPCRouter({
  /**
   * List all quick replies accessible by the current user
   * Returns: organization-wide + user's private replies
   */
  list: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;
    const userId = ctx.session.user.id;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const quickReplies = await tenantDb
      .select()
      .from(quickReply)
      .where(
        and(
          eq(quickReply.organizationId, organizationId),
          eq(quickReply.isActive, true),
          or(
            eq(quickReply.visibility, "organization"),
            and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
          ),
        ),
      )
      .orderBy(desc(quickReply.usageCount), quickReply.title);

    return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
  }),

  /**
   * List all quick replies for admin (owners see all, members see own)
   */
  listAdmin: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;
    const userId = ctx.session.user.id;
    const userRole = ctx.agent.role;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    // Owners veem todas, members veem apenas as próprias
    const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";

    const quickReplies = await tenantDb
      .select()
      .from(quickReply)
      .where(
        isOwnerOrAdmin
          ? eq(quickReply.organizationId, organizationId)
          : and(eq(quickReply.organizationId, organizationId), eq(quickReply.createdBy, userId)),
      )
      .orderBy(desc(quickReply.createdAt));

    return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
  }),

  /**
   * Get quick reply by ID
   */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [result] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar acesso: owners/admins veem todas, members só as próprias ou públicas
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = result.createdBy === userId;
      const isPublic = result.visibility === "organization";

      if (!isOwnerOrAdmin && !isOwn && !isPublic) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar esta resposta rápida",
        });
      }

      return selectQuickReplySchema.parse(result);
    }),

  /**
   * Create a new quick reply
   */
  create: memberProcedure
    .input(insertQuickReplySchema.omit({ organizationId: true, createdBy: true }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe shortcut com mesmo nome na organização
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(
          and(eq(quickReply.organizationId, organizationId), eq(quickReply.shortcut, input.shortcut)),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma resposta rápida com o atalho '${input.shortcut}'`,
        });
      }

      const [newQuickReply] = await tenantDb
        .insert(quickReply)
        .values({
          ...input,
          organizationId,
          createdBy: userId,
          content: getContentPreview(input.messages ?? []),
        })
        .returning();

      return newQuickReply;
    }),

  /**
   * Update a quick reply
   * Members can only update their own, owners/admins can update all
   */
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateQuickReplySchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se existe
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar permissão: owners/admins podem editar todas, members só as próprias
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = existing.createdBy === userId;

      if (!isOwnerOrAdmin && !isOwn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para editar esta resposta rápida",
        });
      }

      // Se estiver mudando o shortcut, verificar se não conflita
      if (input.data.shortcut && input.data.shortcut !== existing.shortcut) {
        const [shortcutConflict] = await tenantDb
          .select()
          .from(quickReply)
          .where(
            and(
              eq(quickReply.organizationId, organizationId),
              eq(quickReply.shortcut, input.data.shortcut),
            ),
          )
          .limit(1);

        if (shortcutConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma resposta rápida com o atalho '${input.data.shortcut}'`,
          });
        }
      }

      // Gerar content automaticamente se messages foi atualizado
      const updateData = {
        ...input.data,
        updatedAt: new Date(),
        ...(input.data.messages && { content: getContentPreview(input.data.messages) }),
      };

      const [updated] = await tenantDb
        .update(quickReply)
        .set(updateData)
        .where(eq(quickReply.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a quick reply
   * Members can only delete their own, owners/admins can delete all
   */
  delete: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;
      const userRole = ctx.agent.role;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se existe
      const [existing] = await tenantDb
        .select()
        .from(quickReply)
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Resposta rápida não encontrada",
        });
      }

      // Verificar permissão
      const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
      const isOwn = existing.createdBy === userId;

      if (!isOwnerOrAdmin && !isOwn) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar esta resposta rápida",
        });
      }

      await tenantDb.delete(quickReply).where(eq(quickReply.id, input.id));

      return { success: true };
    }),

  /**
   * Delete multiple quick replies
   * Only owners/admins can delete multiple
   */
  deleteMany: ownerProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      await Promise.all(
        input.ids.map((id) =>
          tenantDb
            .delete(quickReply)
            .where(and(eq(quickReply.id, id), eq(quickReply.organizationId, organizationId))),
        ),
      );

      return { success: true };
    }),

  /**
   * Increment usage count when a quick reply is used
   */
  use: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      await tenantDb
        .update(quickReply)
        .set({
          usageCount: sql`${quickReply.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(and(eq(quickReply.id, input.id), eq(quickReply.organizationId, organizationId)));

      return { success: true };
    }),

  /**
   * Search quick replies by shortcut (for autocomplete in chat input)
   */
  search: memberProcedure
    .input(
      z.object({
        query: z.string().default(""),
        limit: z.number().min(1).max(10).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;
      const userId = ctx.session.user.id;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Adiciona "/" se não começar com / (ou usa "/" se vazio para listar todas)
      const searchQuery = input.query
        ? input.query.startsWith("/")
          ? input.query
          : `/${input.query}`
        : "/";

      const quickReplies = await tenantDb
        .select()
        .from(quickReply)
        .where(
          and(
            eq(quickReply.organizationId, organizationId),
            eq(quickReply.isActive, true),
            ilike(quickReply.shortcut, `${searchQuery}%`),
            or(
              eq(quickReply.visibility, "organization"),
              and(eq(quickReply.visibility, "private"), eq(quickReply.createdBy, userId)),
            ),
          ),
        )
        .orderBy(desc(quickReply.usageCount))
        .limit(input.limit);

      return quickReplies.map((qr) => selectQuickReplySchema.parse(qr));
    }),
});
