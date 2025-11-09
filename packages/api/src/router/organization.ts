import { z } from "zod";
import slugify from "slugify";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { TenantDatabaseManager } from "@manylead/tenant-db";
import { organization } from "@manylead/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const tenantManager = new TenantDatabaseManager();

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
      const organization = await ctx.authApi.createOrganization({
        body: {
          name: input.name,
          slug,
        },
        headers: ctx.headers,
      });

      if (!organization) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar organização",
        });
      }

      // 4. Provisiona o tenant database
      await tenantManager.provisionTenant({
        organizationId: organization.id,
        slug,
        name: input.name,
      });

      // 5. Define esta organização como ativa na sessão
      await ctx.authApi.setActiveOrganization({
        body: {
          organizationId: organization.id,
        },
        headers: ctx.headers,
      });

      return organization;
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
      const userOrgs = await ctx.authApi.listOrganizations({
        headers: ctx.headers,
      });

      if (userOrgs.length > 0) {
        const firstOrg = userOrgs[0];
        if (firstOrg) {
          // Seta a primeira organização como ativa
          await ctx.authApi.setActiveOrganization({
            body: {
              organizationId: firstOrg.id,
            },
            headers: ctx.headers,
          });
          activeOrgId = firstOrg.id;
        } else {
          return null;
        }
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

    if (currentOrg.length === 0) {
      return null;
    }

    return currentOrg[0];
  }),

  /**
   * List all organizations for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.authApi.listOrganizations({
      headers: ctx.headers,
    });

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
});
