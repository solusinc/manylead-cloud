import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq, organizationSettings } from "@manylead/db";
import { getBrightDataClient } from "@manylead/bright-data";

import { createTRPCRouter, ownerProcedure } from "../trpc";

/**
 * Proxy Settings Router
 *
 * Gerencia configurações de proxy Bright Data por organização
 */
export const proxySettingsRouter = createTRPCRouter({
  /**
   * Get current proxy settings
   */
  get: ownerProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const [orgSettings] = await ctx.tenantDb
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (!orgSettings) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Configurações não encontradas",
      });
    }

    return {
      proxySettings: orgSettings.proxySettings,
      timezone: orgSettings.timezone,
    };
  }),

  /**
   * Toggle proxy on/off and set country
   */
  toggle: ownerProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        country: z
          .enum(["br", "us", "ar", "cl", "mx", "co", "pe", "pt", "es"])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const [orgSettings] = await ctx.tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!orgSettings) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Configurações não encontradas",
        });
      }

      // Gerar novo sessionId se habilitando pela primeira vez
      let sessionId = orgSettings.proxySettings?.sessionId;
      if (input.enabled && !sessionId) {
        const brightData = getBrightDataClient();
        const proxyConfig = brightData.getProxyConfig(
          organizationId,
          { ...orgSettings.proxySettings, enabled: true, country: input.country },
          orgSettings.timezone
        );

        // Extrair sessionId do username
        sessionId = proxyConfig.username?.split("session-")[1]?.split("-country-")[0];
      }

      const [updated] = await ctx.tenantDb
        .update(organizationSettings)
        .set({
          proxySettings: {
            ...orgSettings.proxySettings,
            enabled: input.enabled,
            country: input.country ?? orgSettings.proxySettings?.country,
            sessionId,
            lastKeepAliveAt: input.enabled
              ? new Date().toISOString()
              : orgSettings.proxySettings?.lastKeepAliveAt,
          },
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.organizationId, organizationId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao atualizar configurações",
        });
      }

      return {
        proxySettings: updated.proxySettings,
      };
    }),

  /**
   * Force IP rotation (new session)
   */
  rotate: ownerProcedure.mutation(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const [orgSettings] = await ctx.tenantDb
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    if (!orgSettings) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Configurações não encontradas",
      });
    }

    if (!orgSettings.proxySettings?.enabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Proxy não está habilitado",
      });
    }

    const brightData = getBrightDataClient();
    const { newSessionId, rotationCount } = brightData.rotateProxy(
      organizationId,
      orgSettings.proxySettings,
      orgSettings.timezone
    );

    const [updated] = await ctx.tenantDb
      .update(organizationSettings)
      .set({
        proxySettings: {
          ...orgSettings.proxySettings,
          sessionId: newSessionId,
          rotationCount,
          lastRotatedAt: new Date().toISOString(),
          lastKeepAliveAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning();

    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Falha ao rotacionar IP",
      });
    }

    return {
      proxySettings: updated.proxySettings,
      newSessionId,
      rotationCount,
    };
  }),

  /**
   * Get proxy health status
   */
  health: ownerProcedure.query(({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const brightData = getBrightDataClient();
    const healthStatus = brightData.getHealthStatus(organizationId);

    return {
      health: healthStatus ?? {
        isHealthy: true,
        lastCheckAt: null,
        consecutiveFailures: 0,
        lastError: null,
        currentIp: null,
      },
      circuitState: brightData.getCircuitState(),
      isProxyAvailable: brightData.isProxyAvailable(),
    };
  }),
});
