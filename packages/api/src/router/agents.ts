import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import {
  agent,
  insertAgentSchema,
  selectAgentSchema,
  updateAgentSchema,
  user,
  member,
} from "@manylead/db";

import { createTRPCRouter, protectedProcedure, tenantManager } from "../trpc";

/**
 * Agents Router
 *
 * Gerencia agents (atendentes) do tenant com permissões granulares
 */
export const agentsRouter = createTRPCRouter({
  /**
   * List all agents for the active organization with user data
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

    // Get all agents from tenant database
    const agents = await tenantDb
      .select()
      .from(agent)
      .orderBy(agent.createdAt);

    // Get user data from catalog database for each agent
    const agentsWithUsers = await Promise.all(
      agents.map(async (a) => {
        const [userData] = await ctx.db
          .select()
          .from(user)
          .where(eq(user.id, a.userId))
          .limit(1);

        return {
          ...selectAgentSchema.parse(a),
          user: userData ?? null,
        };
      }),
    );

    return agentsWithUsers;
  }),

  /**
   * Get agent by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
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
        id: z.uuid(),
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
   * Delete an agent (removes from tenant agent table + catalog member table)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
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
          message: "Atendente não encontrado",
        });
      }

      // Não pode deletar a si mesmo
      if (existing.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode remover a si mesmo da organização",
        });
      }

      // 1. Deletar agent do tenant database
      await tenantDb.delete(agent).where(eq(agent.id, input.id));

      // 2. Verificar se existe member no catalog database e deletar
      const [memberToDelete] = await ctx.db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, existing.userId),
            eq(member.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (memberToDelete) {
        try {
          // Remove member usando Better Auth API
          // IMPORTANTE: Usar member.id (não userId) como memberIdOrEmail
          await ctx.authApi.removeMember({
            body: {
              memberIdOrEmail: memberToDelete.id,
              organizationId,
            },
            headers: ctx.headers,
          });
        } catch (error) {
          // Se o member não existir no Better Auth, não é erro crítico
          // O agent já foi removido do tenant DB com sucesso
          console.warn(
            `[agents.delete] Falha ao remover member via Better Auth (memberId: ${memberToDelete.id}):`,
            error,
          );
          // Não lançar erro - o agent já foi removido do tenant DB
        }
      }

      return { success: true };
    }),

  /**
   * Update agent role
   * Only owners can change roles
   * Cannot downgrade the last owner
   */
  updateRole: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        role: z.enum(["owner", "admin", "member"]),
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

      // Verificar se usuário atual é proprietário
      const [currentUserAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!currentUserAgent || currentUserAgent.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas proprietários podem alterar cargos",
        });
      }

      // Verificar se agent existe
      const [existing] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Membro não encontrado",
        });
      }

      // Se está tentando rebaixar um proprietário, verificar se não é o último
      if (existing.role === "owner" && input.role !== "owner") {
        const ownerCount = await tenantDb
          .select({ count: agent.id })
          .from(agent)
          .where(eq(agent.role, "owner"));

        if (ownerCount.length === 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Não é possível rebaixar o último proprietário. A organização precisa ter pelo menos um proprietário.",
          });
        }
      }

      // Atualizar role
      const [updated] = await tenantDb
        .update(agent)
        .set({
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(agent.id, input.id))
        .returning();

      // Atualizar role no catalog member também
      await ctx.db
        .update(member)
        .set({
          role: input.role,
        })
        .where(
          and(
            eq(member.userId, existing.userId),
            eq(member.organizationId, organizationId),
          ),
        );

      return updated;
    }),
});
