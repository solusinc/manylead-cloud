import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  chat,
  contact,
  count,
  desc,
  eq,
  sql,
  user,
} from "@manylead/db";
import { publishChatEvent } from "@manylead/shared";

import { createTRPCRouter, memberProcedure, ownerProcedure, protectedProcedure } from "../trpc";
import { env } from "../env";

/**
 * Chats Router
 *
 * Gerencia conversas (chats) do tenant - WhatsApp e internos
 */
export const chatsRouter = createTRPCRouter({
  /**
   * Listar chats com filtros e paginação
   */
  list: memberProcedure
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

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Construir where conditions
      const conditions = [];

      // Lógica de visibilidade:
      // 1. Chat com mensagens (totalMessages > 0): aparece para todos os participantes
      // 2. Chat sem mensagens: só aparece para quem CRIOU (initiatorInstanceCode = current agent)
      if (currentAgent) {
        conditions.push(
          sql`(${chat.totalMessages} > 0 OR ${chat.initiatorInstanceCode} = ${currentAgent.instanceCode})`
        );
      } else {
        conditions.push(sql`${chat.totalMessages} > 0`);
      }

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
  getById: memberProcedure
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
   * Criar chat interno via instance code
   * Fluxo completo: buscar agent -> criar/buscar contact -> detectar duplicata -> criar chat
   */
  createInternalChat: protectedProcedure
    .input(
      z.object({
        targetInstanceCode: z.string(),
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

      const { tenantManager } = await import("../trpc");
      const tenantDb = await tenantManager.getConnection(organizationId);

      // 1. Buscar target agent por instanceCode
      const [targetAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.instanceCode, input.targetInstanceCode))
        .limit(1);

      if (!targetAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Instance code não encontrado",
        });
      }

      // Não pode criar chat consigo mesmo
      if (targetAgent.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode criar um chat consigo mesmo",
        });
      }

      // 2. Buscar user do target agent para pegar nome e avatar
      const [targetUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, targetAgent.userId))
        .limit(1);

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      // 3. Criar/buscar contact interno para o target agent
      const existingContacts = await tenantDb
        .select()
        .from(contact)
        .where(eq(contact.organizationId, organizationId));

      let targetContact = existingContacts.find(
        (c) => c.metadata?.agentId === targetAgent.id,
      );

      if (!targetContact) {
        // Criar novo contato interno
        const [newContact] = await tenantDb
          .insert(contact)
          .values({
            organizationId,
            phoneNumber: null,
            name: targetUser.name,
            avatar: targetUser.image ?? undefined,
            metadata: {
              source: "internal" as const,
              agentId: targetAgent.id,
              firstMessageAt: new Date(),
            },
          })
          .returning();

        if (!newContact) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Falha ao criar contato interno",
          });
        }

        targetContact = newContact;
      }

      // 4. Buscar o agent atual (criador do chat)
      const [currentAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent atual não encontrado",
        });
      }

      // 5. Detectar chat duplicado (verificar se já existe chat interno entre os 2 agents)
      const existingChat = await tenantDb
        .select({
          chat,
          contact,
        })
        .from(chat)
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .where(
          and(
            eq(chat.messageSource, "internal"),
            eq(chat.contactId, targetContact.id),
          ),
        )
        .limit(1);

      if (existingChat.length > 0 && existingChat[0]?.chat) {
        // Chat já existe, retornar ele
        return existingChat[0].chat;
      }

      // 6. Criar novo chat interno
      const now = new Date();
      const [newChat] = await tenantDb
        .insert(chat)
        .values({
          organizationId,
          contactId: targetContact.id,
          channelId: null, // Chats internos não têm canal
          messageSource: "internal",
          initiatorInstanceCode: currentAgent.instanceCode,
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

      // Emitir evento Socket.io: chat:created
      await publishChatEvent(
        {
          type: "chat:created",
          organizationId,
          chatId: newChat.id,
          data: {
            chat: newChat as unknown as Record<string, unknown>,
            contact: targetContact as unknown as Record<string, unknown>,
          },
        },
        env.REDIS_URL,
      );

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
