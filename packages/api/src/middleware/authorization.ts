import { TRPCError } from "@trpc/server";

import type { Actions, AgentRole, Subjects } from "@manylead/permissions";
import { agent, eq } from "@manylead/db";
import { defineAbilitiesFor } from "@manylead/permissions";

import type { BaseContext } from "../types";
import { getTenantDb } from "../types";

/**
 * Helper para buscar o agente atual e criar a ability
 */
async function getAgentWithAbility(ctx: BaseContext) {
  if (!ctx.session?.user.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Você precisa estar autenticado",
    });
  }

  if (!ctx.session.session.activeOrganizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Nenhuma organização ativa",
    });
  }

  // Get tenant database
  const { tenantDb } = await getTenantDb(ctx);

  // Buscar agente no tenant DB
  const agents = await tenantDb
    .select()
    .from(agent)
    .where(eq(agent.userId, ctx.session.user.id))
    .limit(1);

  const currentAgent = agents[0];

  if (!currentAgent) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Agente não encontrado nesta organização",
    });
  }

  // Criar ability baseado no role
  const ability = defineAbilitiesFor(
    currentAgent.role as AgentRole,
    ctx.session.user.id,
  );

  return {
    agent: currentAgent,
    ability,
    tenantDb,
  };
}

/**
 * Middleware que injeta ability e agent no contexto
 */
export async function withAbility(ctx: BaseContext) {
  // Garantir que session existe antes de buscar agent
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sessão inválida",
    });
  }

  const {
    agent: currentAgent,
    ability,
    tenantDb,
  } = await getAgentWithAbility(ctx);

  return {
    ...ctx,
    // Explicitly include session to narrow type (similar to enforceUserIsAuthed)
    session: { ...ctx.session, user: ctx.session.user },
    ability,
    agent: currentAgent,
    tenantDb,
  };
}

/**
 * Middleware que requer um role específico
 * Usa hierarquia: owner > admin > member
 */
export function requireRole(requiredRole: AgentRole) {
  return async (ctx: BaseContext) => {
    const newCtx = await withAbility(ctx);

    const roleHierarchy: Record<AgentRole, number> = {
      owner: 3,
      admin: 2,
      member: 1,
    };

    const userRoleLevel = roleHierarchy[newCtx.agent.role as AgentRole];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Esta operação requer o cargo de ${requiredRole}`,
      });
    }

    return newCtx;
  };
}

/**
 * Middleware que verifica uma ability específica
 */
export function requireAbility(action: Actions, subject: Subjects) {
  return async (ctx: BaseContext) => {
    const newCtx = await withAbility(ctx);

    if (!newCtx.ability.can(action, subject)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Você não tem permissão para ${action} ${subject}`,
      });
    }

    return newCtx;
  };
}
