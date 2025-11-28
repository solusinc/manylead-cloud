import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  chat,
  chatTag,
  eq,
  insertTagSchema,
  selectTagSchema,
  tag,
  updateTagSchema,
} from "@manylead/db";

import { createTRPCRouter, memberProcedure, ownerProcedure, tenantManager } from "../trpc";
import { publishChatEvent } from "@manylead/shared";
import { env } from "../env";

/**
 * Tags Router
 *
 * Gerencia etiquetas para categorização de chats
 */
export const tagsRouter = createTRPCRouter({
  /**
   * List all tags for the active organization
   */
  list: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const tags = await tenantDb
      .select()
      .from(tag)
      .where(eq(tag.organizationId, organizationId))
      .orderBy(tag.name);

    return tags.map((t) => selectTagSchema.parse(t));
  }),

  /**
   * Get tag by ID
   */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [result] = await tenantDb
        .select()
        .from(tag)
        .where(and(eq(tag.id, input.id), eq(tag.organizationId, organizationId)))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Etiqueta não encontrada",
        });
      }

      return selectTagSchema.parse(result);
    }),

  /**
   * Create a new tag
   * Only admins and owners can create tags
   */
  create: ownerProcedure
    .input(insertTagSchema.omit({ organizationId: true }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe tag com mesmo nome
      const [existing] = await tenantDb
        .select()
        .from(tag)
        .where(and(eq(tag.organizationId, organizationId), eq(tag.name, input.name)))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma etiqueta com o nome '${input.name}'`,
        });
      }

      const [newTag] = await tenantDb
        .insert(tag)
        .values({
          ...input,
          organizationId,
        })
        .returning();

      return newTag;
    }),

  /**
   * Update a tag
   * Only admins and owners can update tags
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateTagSchema,
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

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se tag existe
      const [existing] = await tenantDb
        .select()
        .from(tag)
        .where(and(eq(tag.id, input.id), eq(tag.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Etiqueta não encontrada",
        });
      }

      // Se estiver mudando o nome, verificar se não conflita
      if (input.data.name && input.data.name !== existing.name) {
        const [nameConflict] = await tenantDb
          .select()
          .from(tag)
          .where(and(eq(tag.organizationId, organizationId), eq(tag.name, input.data.name)))
          .limit(1);

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe uma etiqueta com o nome '${input.data.name}'`,
          });
        }
      }

      const [updated] = await tenantDb
        .update(tag)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(tag.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a tag
   * Only admins and owners can delete tags
   */
  delete: ownerProcedure
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

      // Verificar se tag existe
      const [existing] = await tenantDb
        .select()
        .from(tag)
        .where(and(eq(tag.id, input.id), eq(tag.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Etiqueta não encontrada",
        });
      }

      await tenantDb.delete(tag).where(eq(tag.id, input.id));

      return { success: true };
    }),

  /**
   * Delete multiple tags
   * Only admins and owners can delete tags
   */
  deleteTags: ownerProcedure
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
            .delete(tag)
            .where(and(eq(tag.id, id), eq(tag.organizationId, organizationId))),
        ),
      );

      return { success: true };
    }),

  // ==========================================
  // Chat Tag Operations
  // ==========================================

  /**
   * List tags for a specific chat
   */
  listByChatId: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Buscar todas as tags associadas ao chat
      const chatTags = await tenantDb
        .select({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
          organizationId: tag.organizationId,
        })
        .from(chatTag)
        .innerJoin(tag, eq(chatTag.tagId, tag.id))
        .where(
          and(eq(chatTag.chatId, input.chatId), eq(chatTag.chatCreatedAt, input.chatCreatedAt)),
        )
        .orderBy(tag.name);

      return chatTags.map((t) => selectTagSchema.parse(t));
    }),

  /**
   * Add tag to chat
   */
  addToChat: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.date(),
        tagId: z.string().uuid(),
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

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se a tag existe e pertence à organização
      const [existingTag] = await tenantDb
        .select()
        .from(tag)
        .where(and(eq(tag.id, input.tagId), eq(tag.organizationId, organizationId)))
        .limit(1);

      if (!existingTag) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Etiqueta não encontrada",
        });
      }

      // Verificar se já não está associada
      const [existingRelation] = await tenantDb
        .select()
        .from(chatTag)
        .where(
          and(
            eq(chatTag.chatId, input.chatId),
            eq(chatTag.chatCreatedAt, input.chatCreatedAt),
            eq(chatTag.tagId, input.tagId),
          ),
        )
        .limit(1);

      if (existingRelation) {
        // Já existe, retornar sem erro
        return { success: true, alreadyExists: true };
      }

      await tenantDb.insert(chatTag).values({
        chatId: input.chatId,
        chatCreatedAt: input.chatCreatedAt,
        tagId: input.tagId,
      });

      // Buscar chat atualizado para broadcast
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.chatId), eq(chat.createdAt, input.chatCreatedAt)))
        .limit(1);

      // Broadcast para todos da org
      if (chatRecord) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: input.chatId,
            data: {
              chat: chatRecord as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return { success: true, alreadyExists: false };
    }),

  /**
   * Remove tag from chat
   */
  removeFromChat: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.date(),
        tagId: z.string().uuid(),
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

      const tenantDb = await tenantManager.getConnection(organizationId);

      await tenantDb
        .delete(chatTag)
        .where(
          and(
            eq(chatTag.chatId, input.chatId),
            eq(chatTag.chatCreatedAt, input.chatCreatedAt),
            eq(chatTag.tagId, input.tagId),
          ),
        );

      // Buscar chat atualizado para broadcast
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.chatId), eq(chat.createdAt, input.chatCreatedAt)))
        .limit(1);

      // Broadcast para todos da org
      if (chatRecord) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: input.chatId,
            data: {
              chat: chatRecord as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return { success: true };
    }),

  /**
   * Update all tags for a chat (replace)
   * Removes existing tags and adds new ones
   */
  updateChatTags: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.date(),
        tagIds: z.array(z.string().uuid()),
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

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Remover todas as tags existentes do chat
      await tenantDb
        .delete(chatTag)
        .where(
          and(eq(chatTag.chatId, input.chatId), eq(chatTag.chatCreatedAt, input.chatCreatedAt)),
        );

      // Adicionar as novas tags
      if (input.tagIds.length > 0) {
        await tenantDb.insert(chatTag).values(
          input.tagIds.map((tagId) => ({
            chatId: input.chatId,
            chatCreatedAt: input.chatCreatedAt,
            tagId,
          })),
        );
      }

      // Buscar chat atualizado para broadcast
      const [chatRecord] = await tenantDb
        .select()
        .from(chat)
        .where(and(eq(chat.id, input.chatId), eq(chat.createdAt, input.chatCreatedAt)))
        .limit(1);

      // Broadcast para todos da org
      if (chatRecord) {
        await publishChatEvent(
          {
            type: "chat:updated",
            organizationId,
            chatId: input.chatId,
            data: {
              chat: chatRecord as unknown as Record<string, unknown>,
            },
          },
          env.REDIS_URL,
        );
      }

      return { success: true };
    }),
});
