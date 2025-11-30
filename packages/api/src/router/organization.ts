import { TRPCError } from "@trpc/server";
import slugify from "slugify";
import { z } from "zod";

import {
  and,
  eq,
  isNull,
  member,
  organization,
  session,
  tenant,
} from "@manylead/db";
import { ActivityLogger, TenantDatabaseManager } from "@manylead/tenant-db";
import { extractKeyFromUrl, getPublicUrl, storage } from "@manylead/storage";
import { MEDIA_LIMITS } from "@manylead/shared/constants";
import { createQueue } from "@manylead/clients/queue";
import { getRedisClient } from "@manylead/clients/redis";

import { createTRPCRouter, ownerProcedure, protectedProcedure } from "../trpc";
import { env } from "../env";

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
   * Initialize a new organization (fast - just creates org record)
   * Use this to get the orgId quickly, then call provision()
   */
  init: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Limitar a 3 organizações por usuário (excluindo deletadas)
      const userOrgsCount = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .leftJoin(tenant, eq(tenant.organizationId, organization.id))
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            isNull(tenant.deletedAt), // Não contar organizações deletadas
          ),
        );

      if (userOrgsCount.length >= 3) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você atingiu o limite máximo de 3 organizações por conta.",
        });
      }

      // 2. Gera slug a partir do nome
      const slug = slugify(input.name, {
        lower: true,
        strict: true,
        locale: "pt",
      });

      if (!slug || slug.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Não foi possível gerar um identificador válido a partir do nome",
        });
      }

      // 3. Verifica se já existe tenant com esse slug
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

      // 4. Define esta organização como ativa na sessão
      await ctx.authApi.setActiveOrganization({
        body: {
          organizationId: createdOrg.id,
        },
        headers: ctx.headers,
      });

      return createdOrg;
    }),

  /**
   * Provision tenant database for an organization (async background job)
   * Call this AFTER init() and connecting to Socket.io
   */
  provision: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Buscar organização
      const org = await ctx.authApi.listOrganizations({
        headers: ctx.headers,
      });

      const organization = org.find((o) => o.id === input.organizationId);
      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      try {
        // 2. Provisiona o tenant database de forma ASSÍNCRONA
        // Isso enfileira um job no BullMQ e retorna imediatamente
        await tenantManager.provisionTenantAsync({
          organizationId: organization.id,
          slug: organization.slug,
          name: organization.name,
          ownerId: ctx.session.user.id,
        });

        return { success: true };
      } catch (error) {
        await activityLogger.logSystemError(error as Error, {
          organizationId: organization.id,
          slug: organization.slug,
          phase: "provisionTenantAsync",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Erro ao provisionar tenant",
        });
      }
    }),

  /**
   * Create a new organization and provision tenant database (LEGACY - mantido para compatibilidade)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Limitar a 3 organizações por usuário (excluindo deletadas)
      const userOrgsCount = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .leftJoin(tenant, eq(tenant.organizationId, organization.id))
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            isNull(tenant.deletedAt), // Não contar organizações deletadas
          ),
        );

      if (userOrgsCount.length >= 3) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você atingiu o limite máximo de 3 organizações por conta.",
        });
      }

      // 2. Gera slug a partir do nome
      const slug = slugify(input.name, {
        lower: true,
        strict: true,
        locale: "pt",
      });

      if (!slug || slug.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Não foi possível gerar um identificador válido a partir do nome",
        });
      }

      // 3. Verifica se já existe tenant com esse slug
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

      try {
        // 4. Provisiona o tenant database de forma ASSÍNCRONA
        // Isso enfileira um job no BullMQ e retorna imediatamente
        // O worker processará o job e publicará eventos via Socket.io
        await tenantManager.provisionTenantAsync({
          organizationId: createdOrg.id,
          slug,
          name: input.name,
          ownerId: ctx.session.user.id, // Owner agent will be created by worker
        });

        // NOTA: O tenant está com status "provisioning"
        // A criação do agent será feita automaticamente pelo worker quando o tenant estiver "active"
        // O dashboard irá receber eventos em tempo real via Socket.io

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
          phase: "provisionTenantAsync",
          userId: ctx.session.user.id,
        });

        // ROLLBACK: Limpar recursos criados
        try {
          // Deletar tenant record (job ainda pode estar na fila, mas não será processado)
          await tenantManager.deleteTenant(createdOrg.id, ctx.session.user.id);

          // Deletar a organização (CASCADE deleta members automaticamente)
          await ctx.db
            .delete(organization)
            .where(eq(organization.id, createdOrg.id));
        } catch (rollbackError) {
          // LOGAR FALHA CRÍTICA DE ROLLBACK
          await activityLogger.logCriticalError(rollbackError as Error, {
            organizationId: createdOrg.id,
            slug,
            originalError:
              error instanceof Error ? error.message : String(error),
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

    // Se não houver organização ativa, tenta pegar a primeira do usuário (excluindo deletadas)
    if (!activeOrgId) {
      // Query direta otimizada ao invés de usar Better Auth
      const userOrgs = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .leftJoin(tenant, eq(tenant.organizationId, organization.id))
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            isNull(tenant.deletedAt), // Excluir organizações deletadas
          ),
        )
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

    // Busca a organização ativa E verifica se o usuário ainda é member (excluindo deletadas)
    // IMPORTANTE: Usa INNER JOIN para garantir que só retorna se o usuário for member
    const currentOrg = await ctx.db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        metadata: organization.metadata,
        instanceCode: organization.instanceCode,
      })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .leftJoin(tenant, eq(tenant.organizationId, organization.id))
      .where(
        and(
          eq(organization.id, activeOrgId),
          eq(member.userId, ctx.session.user.id),
          isNull(tenant.deletedAt), // Excluir organizações deletadas
        ),
      )
      .limit(1);

    // Se não achou, significa que o usuário foi removido da org
    // Limpar activeOrganizationId e tentar pegar outra org
    if (currentOrg.length === 0 || !currentOrg[0]) {
      // Tentar pegar outra organização do usuário
      const otherOrgs = await ctx.db
        .select({ id: organization.id })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(eq(member.userId, ctx.session.user.id))
        .limit(1);

      if (otherOrgs.length > 0 && otherOrgs[0]) {
        // Setar outra organização como ativa
        await ctx.authApi.setActiveOrganization({
          body: {
            organizationId: otherOrgs[0].id,
          },
          headers: ctx.headers,
        });

        // Buscar a nova org ativa
        const newOrg = await ctx.db
          .select({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            logo: organization.logo,
            createdAt: organization.createdAt,
            metadata: organization.metadata,
            instanceCode: organization.instanceCode,
          })
          .from(organization)
          .where(eq(organization.id, otherOrgs[0].id))
          .limit(1);

        return newOrg[0] ?? null;
      }

      return null;
    }

    return currentOrg[0];
  }),

  /**
   * List all organizations for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Query direta otimizada com JOIN - muito mais rápido que Better Auth
    // Filtra organizações deletadas (tenant.deletedAt IS NULL)
    const result = await ctx.db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        createdAt: organization.createdAt,
        metadata: organization.metadata,
        instanceCode: organization.instanceCode,
      })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .leftJoin(tenant, eq(tenant.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, ctx.session.user.id),
          isNull(tenant.deletedAt), // Filtra organizações deletadas
        ),
      );

    return result;
  }),

  /**
   * Update organization name
   */
  updateName: ownerProcedure
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

  /**
   * Delete organization (soft delete)
   * Only owners can delete the organization (enforced by ownerProcedure)
   */
  delete: ownerProcedure.mutation(async ({ ctx }) => {
    const activeOrgId = ctx.session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa encontrada",
      });
    }

    // ownerProcedure já garante que ctx.agent.role === 'owner'
    // Soft delete: marca tenant como deleted (mantém database por 30 dias)
    await tenantManager.deleteTenant(activeOrgId, ctx.session.user.id);

    // Buscar outras organizações do usuário (excluindo deletadas e a atual)
    const otherOrgs = await ctx.db
      .select({ id: organization.id })
      .from(organization)
      .innerJoin(member, eq(member.organizationId, organization.id))
      .leftJoin(tenant, eq(tenant.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, ctx.session.user.id),
          isNull(tenant.deletedAt), // Excluir organizações deletadas
        ),
      )
      .limit(1);

    // Se tiver outra org, setar como ativa
    if (otherOrgs.length > 0 && otherOrgs[0]) {
      await ctx.authApi.setActiveOrganization({
        body: {
          organizationId: otherOrgs[0].id,
        },
        headers: ctx.headers,
      });
    } else {
      // Não tem outras orgs, limpar activeOrganizationId manualmente
      await ctx.db
        .update(session)
        .set({ activeOrganizationId: null })
        .where(eq(session.userId, ctx.session.user.id));
    }

    return { success: true };
  }),

  /**
   * Gerar pre-signed URL para upload de logo
   * Frontend usa isso para fazer upload direto para R2
   */
  getLogoUploadUrl: ownerProcedure
    .input(
      z.object({
        fileName: z.string().min(1),
        mimeType: z
          .string()
          .refine(
            (type) => MEDIA_LIMITS.IMAGE.ALLOWED_TYPES.includes(type as never),
            `Tipo de arquivo não permitido. Use: ${MEDIA_LIMITS.IMAGE.ALLOWED_TYPES.join(", ")}`,
          ),
        expiresIn: z.number().min(60).max(3600).default(300), // 5 minutos default
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

      // Gerar path único para o logo
      // Formato: logos/{organizationId}/{timestamp}{ext}
      const ext = input.fileName.substring(input.fileName.lastIndexOf("."));
      const storagePath = `logos/${activeOrgId}/${Date.now()}${ext}`;

      // Gerar pre-signed URL
      const signedUrl = await storage.getSignedUploadUrl(
        storagePath,
        input.expiresIn,
      );

      return {
        uploadUrl: signedUrl,
        storagePath,
        publicUrl: `${getPublicUrl()}/${storagePath}`,
        expiresIn: input.expiresIn,
      };
    }),

  /**
   * Atualizar logo da organização
   * Chamado após upload direto para R2
   */
  updateLogo: ownerProcedure
    .input(
      z.object({
        imageUrl: z.string().url("URL inválida"),
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

      // Atualizar logo da organização no banco
      const [updated] = await ctx.db
        .update(organization)
        .set({
          logo: input.imageUrl,
        })
        .where(eq(organization.id, activeOrgId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      // Enfileirar job para sincronizar logo cross-org
      const connection = getRedisClient(env.REDIS_URL);
      const queue = createQueue({
        name: "cross-org-logo-sync",
        connection,
      });

      await queue.add("sync-logo", {
        organizationId: activeOrgId,
        logoUrl: input.imageUrl,
      });

      return {
        success: true,
        imageUrl: updated.logo,
      };
    }),

  /**
   * Remover logo da organização
   */
  removeLogo: ownerProcedure.mutation(async ({ ctx }) => {
    const activeOrgId = ctx.session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa encontrada",
      });
    }

    // Buscar logo atual para deletar do R2
    const [currentOrg] = await ctx.db
      .select({ logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, activeOrgId))
      .limit(1);

    // Deletar do R2 se existir
    if (currentOrg?.logo) {
      const key = extractKeyFromUrl(currentOrg.logo);
      if (key) {
        try {
          await storage.delete(key);
        } catch (error) {
          console.error("Erro ao deletar logo do R2:", error);
        }
      }
    }

    // Remover logo da organização no banco
    const [updated] = await ctx.db
      .update(organization)
      .set({
        logo: null,
      })
      .where(eq(organization.id, activeOrgId))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organização não encontrada",
      });
    }

    // Enfileirar job para sincronizar remoção do logo cross-org
    const connection = getRedisClient(env.REDIS_URL);
    const queue = createQueue({
      name: "cross-org-logo-sync",
      connection,
    });

    await queue.add("sync-logo", {
      organizationId: activeOrgId,
      logoUrl: null,
    });

    return {
      success: true,
    };
  }),
});
