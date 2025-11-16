import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, attachment, count, desc, eq, message } from "@manylead/db";

import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Messages Router
 *
 * Gerencia mensagens (WhatsApp e internas) do tenant
 */
export const messagesRouter = createTRPCRouter({
  /**
   * Listar mensagens de um chat com paginação
   */
  list: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        includeDeleted: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { chatId, limit, offset, includeDeleted } = input;

      // Construir where clause
      const conditions = [eq(message.chatId, chatId)];

      if (!includeDeleted) {
        conditions.push(eq(message.isDeleted, false));
      }

      const where = and(...conditions);

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select({
            message,
            attachment,
          })
          .from(message)
          .leftJoin(attachment, eq(message.id, attachment.messageId))
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(message.timestamp)),
        ctx.tenantDb.select({ count: count() }).from(message).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar mensagem por ID
   */
  getById: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Message tem composite PK (id + timestamp)
      const [messageRecord] = await ctx.tenantDb
        .select({
          message,
          attachment,
        })
        .from(message)
        .leftJoin(attachment, eq(message.id, attachment.messageId))
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .limit(1);

      if (!messageRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      return messageRecord;
    }),

  /**
   * Enviar mensagem de texto
   */
  sendText: ownerProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        content: z.string().min(1),
        senderId: z.string().uuid(),
        sender: z.enum(["agent", "system"]),
        metadata: z.record(z.string(), z.unknown()).optional(),
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

      const now = new Date();

      // Criar mensagem (drizzle gera ID automaticamente)
      const [newMessage] = await ctx.tenantDb
        .insert(message)
        .values({
          chatId: input.chatId,
          messageSource: "internal",
          sender: input.sender,
          senderId: input.senderId,
          messageType: "text",
          content: input.content,
          metadata: input.metadata,
          status: "sent",
          timestamp: now,
          sentAt: now,
        })
        .returning();

      if (!newMessage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar mensagem",
        });
      }

      // TODO: Emitir evento Socket.io para atualizar UI em tempo real
      // TODO: Se for WhatsApp, enfileirar job para enviar via Evolution API

      return newMessage;
    }),

  /**
   * Marcar mensagem como lida
   */
  markAsRead: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(message)
        .set({
          status: "read",
          readAt: new Date(),
        })
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      return updated;
    }),

  /**
   * Deletar mensagem (soft delete)
   */
  delete: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        timestamp: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.tenantDb
        .update(message)
        .set({
          isDeleted: true,
        })
        .where(
          and(eq(message.id, input.id), eq(message.timestamp, input.timestamp)),
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mensagem não encontrada",
        });
      }

      return { success: true };
    }),

  /**
   * Buscar mensagens por WhatsApp Message ID (evitar duplicatas)
   */
  findByWhatsappId: ownerProcedure
    .input(z.object({ whatsappMessageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [existing] = await ctx.tenantDb
        .select()
        .from(message)
        .where(eq(message.whatsappMessageId, input.whatsappMessageId))
        .limit(1);

      return existing ?? null;
    }),
});
