import type { TenantDB } from "@manylead/db";
import type { AppAbility } from "@manylead/permissions";
import type { agent } from "@manylead/db";

import type { createTRPCContext } from "./trpc";
import { tenantManager } from "./trpc";

/**
 * Tipo base do contexto tRPC
 */
export type BaseContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Contexto extendido com tenant database helper
 */
export type Context = BaseContext & {
  getTenantDb: () => Promise<{
    tenantDb: TenantDB;
    organizationId: string;
  }>;
};

/**
 * Contexto com autorização (ability e agent injetados)
 */
export type AuthorizedContext = Context & {
  ability: AppAbility;
  agent: typeof agent.$inferSelect;
  tenantDb: TenantDB;
};

/**
 * Helper para obter tenant database connection
 */
export async function getTenantDb(ctx: BaseContext) {
  const organizationId = ctx.session?.session.activeOrganizationId;

  if (!organizationId) {
    throw new Error("Nenhuma organização ativa");
  }

  const tenantDb = await tenantManager.getConnection(organizationId);

  return {
    tenantDb,
    organizationId,
  };
}
