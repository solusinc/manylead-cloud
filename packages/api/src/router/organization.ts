import { z } from "zod";
import slugify from "slugify";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { TenantDatabaseManager, ActivityLogger } from "@manylead/tenant-db";
import { member, organization } from "@manylead/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const tenantManager = new TenantDatabaseManager();
const activityLogger = new ActivityLogger();

/**
 * Organization Router
 *
 * Usa Better Auth para gerenciar organizations, members e invitations.
 * O TenantDatabaseManager é usado manualmente nas mutations (não via hooks).
 */
export const organizationRouter = createTRPCRouter({
  /**
   * Create a new organization and provision tenant database
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Gera slug a partir do nome
      const slug = slugify(input.name, {
        lower: true,
        strict: true,
        locale: "pt",
      });

      if (!slug || slug.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Não foi possível gerar um identificador válido a partir do nome",
        });
      }

      // 2. Verifica se já existe tenant com esse slug
      const existingTenant = await tenantManager.getTenantBySlug(slug);
      if (existingTenant) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe uma organização com o identificador '${slug}'. Por favor, escolha outro nome.`,
        });
      }

      // 3. Cria a organização usando Better Auth
      const createdOrg = await ctx.authApi.createOrganization({
        body: {
          name: input.name,
          slug,
        },
        headers: ctx.headers,
      });

      if (!createdOrg) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar organização",
        });
      }

      // SAGA PATTERN: Se provisioning falhar, fazer rollback da organização
      let tenantProvisioned = false;

      try {
        // 4. Provisiona o tenant database
        await tenantManager.provisionTenant({
          organizationId: createdOrg.id,
          slug,
          name: input.name,
        });
        tenantProvisioned = true;

        // 5. Define esta organização como ativa na sessão
        await ctx.authApi.setActiveOrganization({
          body: {
            organizationId: createdOrg.id,
          },
          headers: ctx.headers,
        });

        return createdOrg;
      } catch (error) {
        // LOGAR FALHA DE PROVISIONING
        await activityLogger.logSystemError(error as Error, {
          organizationId: createdOrg.id,
          slug,
          phase: tenantProvisioned ? "setActive" : "provisionTenant",
          userId: ctx.session.user.id,
        });

        // ROLLBACK: Limpar recursos criados
        try {
          // Se tenant foi provisionado mas setActive falhou, deletar tenant
          if (tenantProvisioned) {
            await tenantManager.deleteTenant(createdOrg.id);
          }

          // Sempre deletar a organização (CASCADE deleta members automaticamente)
          await ctx.db
            .delete(organization)
            .where(eq(organization.id, createdOrg.id));
        } catch (rollbackError) {
          // LOGAR FALHA CRÍTICA DE ROLLBACK
          await activityLogger.logCriticalError(rollbackError as Error, {
            organizationId: createdOrg.id,
            slug,
            originalError: error instanceof Error ? error.message : String(error),
            tenantProvisioned,
            userId: ctx.session.user.id,
          });
        }

        // Re-lançar erro original com mensagem amigável
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Falha ao provisionar organização: ${error.message}`
              : "Falha ao provisionar organização",
          cause: error,
        });
      }
    }),

  /**
   * Get all organizations for the current user
   */
  getUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.authApi.listOrganizations({
      headers: ctx.headers,
    });

    return result;
  }),

  /**
   * Get active organization ID from session
   */
  getActiveOrganizationId: protectedProcedure.query(({ ctx }) => {
    return ctx.session.session.activeOrganizationId ?? null;
  }),

  /**
   * Check if organization name is available
   */
  checkOrganizationAvailability: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const slug = slugify(input.name, {
        lower: true,
        strict: true,
        locale: "pt",
      });

      if (!slug || slug.length < 2) {
        return { available: false, slug: "", reason: "invalid" };
      }

      // Verifica se o slug já existe na tabela organization (Better Auth)
      const existingOrg = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
        .limit(1);

      if (existingOrg.length > 0) {
        return {
          available: false,
          slug,
          reason: "exists",
        };
      }

      // Verifica se o slug já existe na tabela tenant
      const existingTenant = await tenantManager.getTenantBySlug(slug);

      return {
        available: !existingTenant,
        slug,
        reason: existingTenant ? "exists" : null,
      };
    }),

  /**
   * Get current active organization
   */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    let activeOrgId = ctx.session.session.activeOrganizationId;

    // Se não houver organização ativa, tenta pegar a primeira do usuário
    if (!activeOrgId) {
      // Query direta otimizada ao invés de usar Better Auth
      const userOrgs = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(eq(member.userId, ctx.session.user.id))
        .limit(1);

      if (userOrgs.length > 0 && userOrgs[0]) {
        // Seta a primeira organização como ativa
        await ctx.authApi.setActiveOrganization({
          body: {
            organizationId: userOrgs[0].id,
          },
          headers: ctx.headers,
        });
        activeOrgId = userOrgs[0].id;
      } else {
        return null;
      }
    }

    if (!activeOrgId) {
      return null;
    }

    // Busca a organização ativa
    const currentOrg = await ctx.db
      .select()
      .from(organization)
      .where(eq(organization.id, activeOrgId))
      .limit(1);

    if (currentOrg.length === 0 || !currentOrg[0]) {
      return null;
    }

    return currentOrg[0];
  }),

  /**
   * List all organizations for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Query direta otimizada com JOIN - muito mais rápido que Better Auth
    const result = await ctx.db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        metadata: organization.metadata,
      })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .where(eq(member.userId, ctx.session.user.id));

    return result;
  }),

  /**
   * Update organization name
   */
  updateName: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Atualiza o nome da organização no Better Auth
      const result = await ctx.db
        .update(organization)
        .set({
          name: input.name,
        })
        .where(eq(organization.id, activeOrgId))
        .returning();

      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      return result[0];
    }),

  /**
   * Set active organization
   *
   * NOTA: Esta mutation é mantida para casos especiais (ex: aceitar convite),
   * mas NÃO deve ser usada no OrganizationSwitcher devido à latência do Better Auth.
   * O switcher usa atualização otimista de cache para UX instantânea.
   */
  setActive: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1, "ID da organização é obrigatório"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verifica acesso com query otimizada
      const userAccess = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            eq(organization.id, input.organizationId),
          ),
        )
        .limit(1);

      if (userAccess.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem acesso a esta organização",
        });
      }

      // Define a organização como ativa na sessão do Better Auth
      await ctx.authApi.setActiveOrganization({
        body: {
          organizationId: input.organizationId,
        },
        headers: ctx.headers,
      });

      // Busca e retorna a organização ativa
      const activeOrg = await ctx.db
        .select()
        .from(organization)
        .where(eq(organization.id, input.organizationId))
        .limit(1);

      if (activeOrg.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      return activeOrg[0];
    }),
});
