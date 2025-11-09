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
});
