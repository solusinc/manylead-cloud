import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  scheduledMessage,
  agent,
} from "@manylead/db";
import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "@manylead/clients/redis";

import { createTRPCRouter, memberProcedure } from "../trpc";
import { env } from "../env";

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
          .enum(["pending", "processing", "sent", "failed", "cancelled", "expired"])
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
        .leftJoin(
          agent,
          eq(scheduledMessage.createdByAgentId, agent.id),
        )
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
        .leftJoin(
          agent,
          eq(scheduledMessage.createdByAgentId, agent.id),
        )
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
        if (result.status === "pending" || result.status === "sent" || result.status === "cancelled") {
          stats[result.status] = result.count;
        }
      }

      return stats;
    }),
});
