import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  agent,
  and,
  asc,
  chat,
  contact,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  scheduledMessage,
  user,
} from "@manylead/db";
import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "@manylead/clients/redis";

import { env } from "../env";
import { createTRPCRouter, memberProcedure } from "../trpc";

/**
 * Scheduled Messages Router
 *
 * Gerencia agendamentos de mensagens e comentários internos
 */
export const scheduledMessagesRouter = createTRPCRouter({
  /**
   * Criar novo agendamento
   */
  create: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.coerce.date(),
        contentType: z.enum(["message", "comment"]).default("message"),
        content: z.string().min(1, "Conteúdo é obrigatório").max(4000),
        scheduledAt: z.coerce.date(),
        timezone: z.string().min(1, "Timezone é obrigatório"),
        cancelOnContactMessage: z.boolean().default(false),
        cancelOnAgentMessage: z.boolean().default(false),
        cancelOnChatClose: z.boolean().default(false),
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

      // Buscar o agent do usuário atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agente não encontrado",
        });
      }

      // Criar agendamento no DB
      const [schedule] = await ctx.tenantDb
        .insert(scheduledMessage)
        .values({
          organizationId,
          chatId: input.chatId,
          chatCreatedAt: input.chatCreatedAt,
          createdByAgentId: currentAgent.id,
          contentType: input.contentType,
          content: input.content,
          scheduledAt: input.scheduledAt,
          timezone: input.timezone,
          status: "pending",
          cancelOnContactMessage: input.cancelOnContactMessage,
          cancelOnAgentMessage: input.cancelOnAgentMessage,
          cancelOnChatClose: input.cancelOnChatClose,
          metadata: {
            history: [
              {
                action: "created" as const,
                agentId: currentAgent.id,
                agentName: ctx.session.user.name,
                timestamp: new Date().toISOString(),
                details: {},
              },
            ],
          },
        })
        .returning();

      if (!schedule) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar agendamento",
        });
      }

      // Calcular delay para BullMQ
      const delay = input.scheduledAt.getTime() - Date.now();

      // Adicionar job na fila
      const connection = getRedisClient(env.REDIS_URL);
      const queue = createQueue({
        name: "scheduled-message",
        connection,
      });

      const job = await queue.add(
        "send-scheduled-message",
        {
          scheduledMessageId: schedule.id,
          organizationId,
          chatId: input.chatId,
          chatCreatedAt: input.chatCreatedAt.toISOString(),
          contentType: input.contentType,
          content: input.content,
          createdByAgentId: currentAgent.id,
        },
        {
          delay,
          jobId: `scheduled-${organizationId}-${schedule.id}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000, // 5s, 25s, 125s
          },
          removeOnComplete: {
            age: 7 * 24 * 60 * 60, // 7 dias
          },
          removeOnFail: {
            age: 30 * 24 * 60 * 60, // 30 dias
          },
        },
      );

      // Atualizar com jobId
      await ctx.tenantDb
        .update(scheduledMessage)
        .set({ jobId: job.id })
        .where(eq(scheduledMessage.id, schedule.id));

      return { ...schedule, jobId: job.id };
    }),

  /**
   * Listar agendamentos por chat
   */
  listByChat: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.coerce.date(),
        status: z
          .enum([
            "pending",
            "processing",
            "sent",
            "failed",
            "cancelled",
            "expired",
          ])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(scheduledMessage.chatId, input.chatId),
        eq(scheduledMessage.chatCreatedAt, input.chatCreatedAt),
      ];

      if (input.status) {
        conditions.push(eq(scheduledMessage.status, input.status));
      }

      const items = await ctx.tenantDb
        .select({
          scheduledMessage,
          createdByAgent: agent,
        })
        .from(scheduledMessage)
        .leftJoin(agent, eq(scheduledMessage.createdByAgentId, agent.id))
        .where(and(...conditions))
        .orderBy(desc(scheduledMessage.scheduledAt));

      return items;
    }),

  /**
   * Buscar agendamento por ID
   */
  getById: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.tenantDb
        .select({
          scheduledMessage,
          createdByAgent: agent,
        })
        .from(scheduledMessage)
        .leftJoin(agent, eq(scheduledMessage.createdByAgentId, agent.id))
        .where(eq(scheduledMessage.id, input.id))
        .limit(1);

      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agendamento não encontrado",
        });
      }

      return item;
    }),

  /**
   * Atualizar agendamento (apenas se pending)
   */
  update: memberProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.string().min(1).max(4000).optional(),
        scheduledAt: z.coerce.date().optional(),
        cancelOnContactMessage: z.boolean().optional(),
        cancelOnAgentMessage: z.boolean().optional(),
        cancelOnChatClose: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se existe e está pending
      const [existing] = await ctx.tenantDb
        .select()
        .from(scheduledMessage)
        .where(eq(scheduledMessage.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agendamento não encontrado",
        });
      }

      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas agendamentos pendentes podem ser atualizados",
        });
      }

      // Buscar agent atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Atualizar campos
      const updateData: Partial<typeof scheduledMessage.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.content !== undefined) {
        updateData.content = input.content;
      }
      if (input.scheduledAt !== undefined) {
        updateData.scheduledAt = input.scheduledAt;
      }
      if (input.cancelOnContactMessage !== undefined) {
        updateData.cancelOnContactMessage = input.cancelOnContactMessage;
      }
      if (input.cancelOnAgentMessage !== undefined) {
        updateData.cancelOnAgentMessage = input.cancelOnAgentMessage;
      }
      if (input.cancelOnChatClose !== undefined) {
        updateData.cancelOnChatClose = input.cancelOnChatClose;
      }

      // Adicionar ao histórico
      updateData.metadata = {
        ...existing.metadata,
        history: [
          ...existing.metadata.history,
          {
            action: "updated" as const,
            agentId: currentAgent?.id,
            agentName: ctx.session.user.name,
            timestamp: new Date().toISOString(),
            details: { fields: Object.keys(input).filter((k) => k !== "id") },
          },
        ],
      };

      const [updated] = await ctx.tenantDb
        .update(scheduledMessage)
        .set(updateData)
        .where(eq(scheduledMessage.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao atualizar agendamento",
        });
      }

      // Se scheduledAt foi atualizado, precisamos atualizar o job no BullMQ
      if (input.scheduledAt !== undefined && existing.jobId) {
        const organizationId = ctx.session.session.activeOrganizationId;

        if (!organizationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhuma organização ativa",
          });
        }

        const connection = getRedisClient(env.REDIS_URL);
        const queue = createQueue({
          name: "scheduled-message",
          connection,
        });

        // Remover job antigo
        const oldJob = await queue.getJob(existing.jobId);
        if (oldJob) {
          await oldJob.remove();
        }

        // Criar novo job com novo delay
        const delay = input.scheduledAt.getTime() - Date.now();
        const newJob = await queue.add(
          "send-scheduled-message",
          {
            scheduledMessageId: updated.id,
            organizationId,
            chatId: existing.chatId,
            chatCreatedAt: existing.chatCreatedAt.toISOString(),
            contentType: existing.contentType,
            content: input.content ?? existing.content,
            createdByAgentId: existing.createdByAgentId,
          },
          {
            delay,
            jobId: `scheduled-${organizationId}-${updated.id}`,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
            removeOnComplete: {
              age: 7 * 24 * 60 * 60,
            },
            removeOnFail: {
              age: 30 * 24 * 60 * 60,
            },
          },
        );

        // Atualizar jobId
        await ctx.tenantDb
          .update(scheduledMessage)
          .set({ jobId: newJob.id })
          .where(eq(scheduledMessage.id, updated.id));
      }

      return updated;
    }),

  /**
   * Cancelar agendamento
   */
  cancel: memberProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verificar se existe e está pending
      const [existing] = await ctx.tenantDb
        .select()
        .from(scheduledMessage)
        .where(eq(scheduledMessage.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agendamento não encontrado",
        });
      }

      if (existing.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Apenas agendamentos pendentes podem ser cancelados",
        });
      }

      // Buscar agent atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Cancelar no DB
      await ctx.tenantDb
        .update(scheduledMessage)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByAgentId: currentAgent?.id,
          cancellationReason: "manual",
          metadata: {
            ...existing.metadata,
            history: [
              ...existing.metadata.history,
              {
                action: "cancelled" as const,
                agentId: currentAgent?.id,
                agentName: ctx.session.user.name,
                timestamp: new Date().toISOString(),
                details: { reason: "manual" },
              },
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(scheduledMessage.id, input.id));

      // Remover job do BullMQ
      if (existing.jobId) {
        const connection = getRedisClient(env.REDIS_URL);
        const queue = createQueue({
          name: "scheduled-message",
          connection,
        });

        const job = await queue.getJob(existing.jobId);
        if (job) {
          await job.remove();
        }
      }

      return { success: true };
    }),

  /**
   * Cancelar múltiplos agendamentos de uma vez
   */
  cancelMany: memberProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Buscar agendamentos existentes
      const existing = await ctx.tenantDb
        .select()
        .from(scheduledMessage)
        .where(inArray(scheduledMessage.id, input.ids));

      if (existing.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhum agendamento encontrado",
        });
      }

      // Filtrar apenas os pending
      const pendingMessages = existing.filter((m) => m.status === "pending");

      if (pendingMessages.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhum agendamento pendente selecionado",
        });
      }

      // Buscar agent atual
      const [currentAgent] = await ctx.tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      // Cancelar todos no DB
      await ctx.tenantDb
        .update(scheduledMessage)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByAgentId: currentAgent?.id,
          cancellationReason: "manual",
          updatedAt: new Date(),
        })
        .where(inArray(scheduledMessage.id, pendingMessages.map((m) => m.id)));

      // Remover jobs do BullMQ
      const connection = getRedisClient(env.REDIS_URL);
      const queue = createQueue({
        name: "scheduled-message",
        connection,
      });

      for (const msg of pendingMessages) {
        if (msg.jobId) {
          const job = await queue.getJob(msg.jobId);
          if (job) {
            await job.remove();
          }
        }
      }

      return { success: true, cancelled: pendingMessages.length };
    }),

  /**
   * Listar agendamentos por organização (página global /schedules)
   */
  listByOrganization: memberProcedure
    .input(
      z.object({
        // Filtros
        status: z
          .enum([
            "pending",
            "processing",
            "sent",
            "failed",
            "cancelled",
            "expired",
          ])
          .optional(),
        contentType: z.enum(["message", "comment"]).optional(),

        // Filtros de data
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),

        // Paginação
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),

        // Ordenação
        sortBy: z
          .enum(["scheduledAt", "createdAt", "updatedAt"])
          .default("scheduledAt"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
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

      // Build conditions
      const conditions = [eq(scheduledMessage.organizationId, organizationId)];

      if (input.status) {
        conditions.push(eq(scheduledMessage.status, input.status));
      }

      if (input.contentType) {
        conditions.push(eq(scheduledMessage.contentType, input.contentType));
      }

      if (input.dateFrom) {
        conditions.push(gte(scheduledMessage.scheduledAt, input.dateFrom));
      }

      if (input.dateTo) {
        conditions.push(lte(scheduledMessage.scheduledAt, input.dateTo));
      }

      // Calculate pagination
      const offset = (input.page - 1) * input.pageSize;

      // Execute query with joins (tenant DB)
      const rawItems = await ctx.tenantDb
        .select({
          scheduledMessage,
          createdByAgent: agent,
          chat,
          contact,
        })
        .from(scheduledMessage)
        .leftJoin(agent, eq(scheduledMessage.createdByAgentId, agent.id))
        .leftJoin(
          chat,
          and(
            eq(scheduledMessage.chatId, chat.id),
            eq(scheduledMessage.chatCreatedAt, chat.createdAt),
          ),
        )
        .leftJoin(contact, eq(chat.contactId, contact.id))
        .where(and(...conditions))
        .orderBy(
          input.sortOrder === "desc"
            ? desc(scheduledMessage[input.sortBy])
            : asc(scheduledMessage[input.sortBy]),
        )
        .limit(input.pageSize)
        .offset(offset);

      // Buscar users do catalog DB
      const userIds = rawItems
        .map((item) => item.createdByAgent?.userId)
        .filter((id): id is string => !!id);

      const users =
        userIds.length > 0
          ? await ctx.db
              .select({
                id: user.id,
                name: user.name,
                email: user.email,
              })
              .from(user)
              .where(inArray(user.id, userIds))
          : [];

      const usersMap = new Map(users.map((u) => [u.id, u]));

      // Merge user data
      const items = rawItems.map((item) => ({
        ...item,
        createdByUser: item.createdByAgent?.userId
          ? usersMap.get(item.createdByAgent.userId) ?? null
          : null,
      }));

      // Get total count for pagination
      const [countResult] = await ctx.tenantDb
        .select({ total: count() })
        .from(scheduledMessage)
        .where(and(...conditions));

      const total = countResult?.total ?? 0;

      return {
        items,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  /**
   * Estatísticas por chat
   */
  stats: memberProcedure
    .input(
      z.object({
        chatId: z.string().uuid(),
        chatCreatedAt: z.coerce.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const results = await ctx.tenantDb
        .select({
          status: scheduledMessage.status,
          count: count(),
        })
        .from(scheduledMessage)
        .where(
          and(
            eq(scheduledMessage.chatId, input.chatId),
            eq(scheduledMessage.chatCreatedAt, input.chatCreatedAt),
            // Apenas status relevantes para UI
            inArray(scheduledMessage.status, ["pending", "sent", "cancelled"]),
          ),
        )
        .groupBy(scheduledMessage.status);

      // Transformar em objeto { pending: 0, sent: 0, cancelled: 0 }
      const stats = {
        pending: 0,
        sent: 0,
        cancelled: 0,
      };

      for (const result of results) {
        if (
          result.status === "pending" ||
          result.status === "sent" ||
          result.status === "cancelled"
        ) {
          stats[result.status] = result.count;
        }
      }

      return stats;
    }),
});
