import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  agent,
  and,
  eq,
  inArray,
  insertAgentSchema,
  member,
  organization,
  selectAgentSchema,
  updateAgentSchema,
  user,
} from "@manylead/db";

import {
  createTRPCRouter,
  ownerProcedure,
  protectedProcedure,
  tenantManager,
} from "../trpc";

/**
 * Agents Router
 *
 * Gerencia agents (usuários) do tenant com permissões granulares
 */
export const agentsRouter = createTRPCRouter({
  /**
   * Get current agent (logged in user)
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      return null;
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const [agentRecord] = await tenantDb
      .select()
      .from(agent)
      .where(eq(agent.userId, ctx.session.user.id))
      .limit(1);

    return agentRecord ?? null;
  }),

  /**
   * List all agents for the active organization with user data
   */
  list: ownerProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    // Get all agents from tenant database
    const agents = await tenantDb.select().from(agent).orderBy(agent.createdAt);

    // Se não houver agents, retornar array vazio
    if (agents.length === 0) {
      return [];
    }

    // Get all user IDs
    const userIds = agents.map((a) => a.userId);

    // Get all users in a single query using WHERE IN
    const users = await ctx.db
      .select()
      .from(user)
      .where(inArray(user.id, userIds));

    // Create a map for O(1) lookup
    const usersById = new Map(users.map((u) => [u.id, u]));

    // Combine agents with their users
    const agentsWithUsers = agents.map((a) => ({
      ...selectAgentSchema.parse(a),
      user: usersById.get(a.userId) ?? null,
    }));

    return agentsWithUsers;
  }),

  /**
   * Get agent by ID
   * Only admins and owners can view any agent (enforced by ownerProcedure)
   */
  getById: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure

      const [agentRecord] = await ctx.tenantDb
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

      // Get user data from catalog database
      const [userData] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.id, agentRecord.userId))
        .limit(1);

      return {
        ...selectAgentSchema.parse(agentRecord),
        user: userData ?? null,
      };
    }),

  /**
   * Get agent by userId
   * Users can get their own agent, admins/owners can get any agent
   */
  getByUserId: protectedProcedure
    .input(
      z.object({ userId: z.string(), organizationId: z.string().optional() }),
    )
    .query(async ({ ctx, input }) => {
      // Se está buscando agent de outro usuário, precisa ser admin/owner
      if (input.userId !== ctx.session.user.id) {
        // Verificar se o usuário atual é member da org e pegar seu role
        const activeOrgId =
          input.organizationId ?? ctx.session.session.activeOrganizationId;

        if (!activeOrgId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para acessar este recurso",
          });
        }

        const [currentMember] = await ctx.db
          .select({ role: member.role })
          .from(member)
          .where(
            and(
              eq(member.userId, ctx.session.user.id),
              eq(member.organizationId, activeOrgId),
            ),
          )
          .limit(1);

        // Apenas owner ou admin podem buscar agents de outros usuários
        if (
          !currentMember ||
          (currentMember.role !== "owner" && currentMember.role !== "admin")
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Você não tem permissão para acessar este recurso",
          });
        }
      }

      // Usar organizationId do input se fornecido, senão pegar da sessão
      let organizationId =
        input.organizationId ?? ctx.session.session.activeOrganizationId;

      // Se ainda não tiver, buscar a primeira org do usuário
      if (!organizationId) {
        const userOrgs = await ctx.db
          .select({ id: organization.id })
          .from(organization)
          .innerJoin(member, eq(member.organizationId, organization.id))
          .where(eq(member.userId, ctx.session.user.id))
          .limit(1);

        if (userOrgs.length === 0 || !userOrgs[0]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Nenhuma organização encontrada para este usuário",
          });
        }

        organizationId = userOrgs[0].id;
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
   * Only admins and owners can create agents (enforced by ownerProcedure)
   */
  create: ownerProcedure
    .input(insertAgentSchema)
    .mutation(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure

      // Verificar se já existe agent com mesmo userId
      const [existing] = await ctx.tenantDb
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

      const [newAgent] = await ctx.tenantDb
        .insert(agent)
        .values(input)
        .returning();

      return newAgent;
    }),

  /**
   * Update an agent
   * Only admins and owners can update agents (enforced by ownerProcedure)
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.uuid(),
        data: updateAgentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure

      // Verificar se agent existe
      const [existing] = await ctx.tenantDb
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
        const [userIdConflict] = await ctx.tenantDb
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

      const [updated] = await ctx.tenantDb
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
   * Only admins and owners can delete agents (enforced by ownerProcedure)
   */
  delete: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      // Verificar se agent existe
      const [existing] = await ctx.tenantDb
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
      await ctx.tenantDb.delete(agent).where(eq(agent.id, input.id));

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
   * Only owners can change roles (enforced by ownerProcedure)
   * Cannot downgrade the last owner
   */
  updateRole: ownerProcedure
    .input(
      z.object({
        id: z.uuid(),
        role: z.enum(["owner", "admin", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure
      // ctx.agent contém o agente atual (já validado como owner)

      // Verificar se agent existe
      const [existing] = await ctx.tenantDb
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
        const ownerCount = await ctx.tenantDb
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
      const [updated] = await ctx.tenantDb
        .update(agent)
        .set({
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(agent.id, input.id))
        .returning();

      // Atualizar role no catalog member também
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

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
