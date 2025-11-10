import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  agent,
  insertAgentSchema,
  updateAgentSchema,
} from "@manylead/db";

import { createTRPCRouter, protectedProcedure, tenantManager } from "../trpc";

/**
 * Agents Router
 *
 * Gerencia agents (atendentes) do tenant com permissões granulares
 */
export const agentsRouter = createTRPCRouter({
  /**
   * List all agents for the active organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    // TODO: Adicionar join com department quando necessário
    const agents = await tenantDb
      .select()
      .from(agent)
      .orderBy(agent.createdAt);

    return agents;
  }),

  /**
   * Get agent by ID
   */
  getById: protectedProcedure
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

      const [agentRecord] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.id))
        .limit(1);

      if (!agentRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      return agentRecord;
    }),

  /**
   * Get agent by userId
   */
  getByUserId: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [agentRecord] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, input.userId))
        .limit(1);

      return agentRecord ?? null;
    }),

  /**
   * Create a new agent
   */
  create: protectedProcedure
    .input(insertAgentSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe agent com mesmo userId
      const [existing] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, input.userId))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe um agent com o userId '${input.userId}'`,
        });
      }

      const [newAgent] = await tenantDb
        .insert(agent)
        .values(input)
        .returning();

      return newAgent;
    }),

  /**
   * Update an agent
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateAgentSchema,
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

      // Verificar se agent existe
      const [existing] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      // Se estiver mudando o userId, verificar se não conflita
      if (input.data.userId && input.data.userId !== existing.userId) {
        const [userIdConflict] = await tenantDb
          .select()
          .from(agent)
          .where(eq(agent.userId, input.data.userId))
          .limit(1);

        if (userIdConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um agent com o userId '${input.data.userId}'`,
          });
        }
      }

      const [updated] = await tenantDb
        .update(agent)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(agent.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete an agent
   */
  delete: protectedProcedure
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

      // Verificar se agent existe
      const [existing] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      await tenantDb.delete(agent).where(eq(agent.id, input.id));

      return { success: true };
    }),

  /**
   * Update agent conversation count
   * Used by auto-assignment system
   */
  updateConversationCount: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        increment: z.boolean().default(true),
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

      const [existing] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent não encontrado",
        });
      }

      const newCount = input.increment
        ? existing.currentActiveConversations + 1
        : Math.max(0, existing.currentActiveConversations - 1);

      const [updated] = await tenantDb
        .update(agent)
        .set({
          currentActiveConversations: newCount,
          updatedAt: new Date(),
        })
        .where(eq(agent.id, input.id))
        .returning();

      return updated;
    }),
});
