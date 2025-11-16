import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { agent, and, chat, contact, count, desc, eq, sql } from "@manylead/db";

import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Chats Router
 *
 * Gerencia conversas (chats) do tenant - WhatsApp e internos
 */
export const chatsRouter = createTRPCRouter({
  /**
   * Listar chats com filtros e paginação
   */
  list: ownerProcedure
    .input(
      z.object({
        status: z.enum(["open", "pending", "closed", "snoozed"]).optional(),
        assignedTo: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        messageSource: z.enum(["whatsapp", "internal"]).optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, assignedTo, departmentId, messageSource, limit, offset } =
        input;

      // Construir where conditions
      const conditions = [];

      if (status) {
        conditions.push(eq(chat.status, status));
      }

      if (assignedTo) {
        conditions.push(eq(chat.assignedTo, assignedTo));
      }

      if (departmentId) {
        conditions.push(eq(chat.departmentId, departmentId));
      }

      if (messageSource) {
        conditions.push(eq(chat.messageSource, messageSource));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Executar queries em paralelo
      const [items, totalResult] = await Promise.all([
        ctx.tenantDb
          .select({
            chat,
            contact,
            assignedAgent: agent,
          })
          .from(chat)
          .leftJoin(contact, eq(chat.contactId, contact.id))
          .leftJoin(agent, eq(chat.assignedTo, agent.id))
          .where(where)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(chat.lastMessageAt)),
        ctx.tenantDb.select({ count: count() }).from(chat).where(where),
      ]);

      return {
        items,
        total: totalResult[0]?.count ?? 0,
        limit,
        offset,
      };
    }),

  /**
   * Buscar chat por ID com informações relacionadas
   */
  getById: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Chat tem composite PK (id + createdAt)
      const [chatRecord] = await ctx.tenantDb
        .select({
          chat,
          contact,
          assignedAgent: agent,
        })
        .from(chat)
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .leftJoin(agent, eq(chat.assignedTo, agent.id))
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .limit(1);

      if (!chatRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return chatRecord;
    }),

  /**
   * Criar novo chat (interno ou WhatsApp)
   */
  create: ownerProcedure
    .input(
      z.object({
        contactId: z.string().uuid(),
        channelId: z.string().uuid().optional(),
        messageSource: z.enum(["whatsapp", "internal"]),
        assignedTo: z.string().uuid().optional(),
        departmentId: z.string().uuid().optional(),
        initiatorInstanceCode: z.string().optional(),
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

      // Drizzle gera ID automaticamente
      const [newChat] = await ctx.tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId: input.contactId,
          channelId: input.channelId,
          messageSource: input.messageSource,
          assignedTo: input.assignedTo,
          departmentId: input.departmentId,
          initiatorInstanceCode: input.initiatorInstanceCode,
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!newChat) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar chat",
        });
      }

      return newChat;
    }),

  /**
   * Atualizar chat (status, atribuição, etc)
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        status: z.enum(["open", "pending", "closed", "snoozed"]).optional(),
        assignedTo: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        isArchived: z.boolean().optional(),
        isPinned: z.boolean().optional(),
        snoozedUntil: z.date().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, createdAt, ...data } = input;

      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, id), eq(chat.createdAt, createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Marcar mensagens como lidas (zerar unreadCount)
   */
  markAsRead: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          unreadCount: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Atribuir chat a um agent
   */
  assign: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
        agentId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se agent existe
      const [agentExists] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.agentId))
        .limit(1);

      if (!agentExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          assignedTo: input.agentId,
          status: "open",
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Fechar chat
   */
  close: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          status: "closed",
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Reabrir chat
   */
  reopen: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        createdAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.tenantDb
        .update(chat)
        .set({
          status: "open",
          updatedAt: new Date(),
        })
        .where(and(eq(chat.id, input.id), eq(chat.createdAt, input.createdAt)))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat não encontrado",
        });
      }

      return updated;
    }),

  /**
   * Estatísticas dos chats
   */
  stats: ownerProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.tenantDb
      .select({
        total: count(),
        open: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'open')`,
        pending: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'pending')`,
        closed: sql<number>`count(*) FILTER (WHERE ${chat.status} = 'closed')`,
        unassigned: sql<number>`count(*) FILTER (WHERE ${chat.assignedTo} IS NULL)`,
      })
      .from(chat);

    return stats;
  }),
});
