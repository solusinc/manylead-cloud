import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  eq,
  organizationSettings,
  organizationWorkingHoursSchema,
  updateOrganizationSettingsSchema,
} from "@manylead/db";

import { createTRPCRouter, ownerProcedure, tenantManager } from "../trpc";

/**
 * Organization Settings Router
 *
 * Gerencia configurações gerais da organização (timezone, working hours, etc.)
 */
export const organizationSettingsRouter = createTRPCRouter({
  /**
   * Get organization settings
   */
  get: ownerProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const [settings] = await tenantDb
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1);

    // Se não existir, criar com valores padrão
    if (!settings) {
      const [newSettings] = await tenantDb
        .insert(organizationSettings)
        .values({
          organizationId,
          timezone: "America/Sao_Paulo",
          workingHours: {
            enabled: false,
            schedule: {
              monday: { start: "09:00", end: "18:00", enabled: true },
              tuesday: { start: "09:00", end: "18:00", enabled: true },
              wednesday: { start: "09:00", end: "18:00", enabled: true },
              thursday: { start: "09:00", end: "18:00", enabled: true },
              friday: { start: "09:00", end: "18:00", enabled: true },
              saturday: { start: "09:00", end: "13:00", enabled: false },
              sunday: { start: "09:00", end: "13:00", enabled: false },
            },
          },
        })
        .returning();

      return newSettings;
    }

    return settings;
  }),

  /**
   * Update timezone
   */
  updateTimezone: ownerProcedure
    .input(
      z.object({
        timezone: z.string().min(1, "Fuso horário é obrigatório"),
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

      // Verificar se settings existe
      const [existing] = await tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        // Criar com timezone fornecido
        const [newSettings] = await tenantDb
          .insert(organizationSettings)
          .values({
            organizationId,
            timezone: input.timezone,
            workingHours: {
              enabled: false,
              schedule: {
                monday: { start: "09:00", end: "18:00", enabled: true },
                tuesday: { start: "09:00", end: "18:00", enabled: true },
                wednesday: { start: "09:00", end: "18:00", enabled: true },
                thursday: { start: "09:00", end: "18:00", enabled: true },
                friday: { start: "09:00", end: "18:00", enabled: true },
                saturday: { start: "09:00", end: "13:00", enabled: false },
                sunday: { start: "09:00", end: "13:00", enabled: false },
              },
            },
          })
          .returning();

        return newSettings;
      }

      // Atualizar timezone
      const [updated] = await tenantDb
        .update(organizationSettings)
        .set({
          timezone: input.timezone,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    }),

  /**
   * Update working hours
   */
  updateWorkingHours: ownerProcedure
    .input(
      z.object({
        workingHours: organizationWorkingHoursSchema,
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

      // Verificar se settings existe
      const [existing] = await tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        // Criar com working hours fornecido
        const [newSettings] = await tenantDb
          .insert(organizationSettings)
          .values({
            organizationId,
            timezone: "America/Sao_Paulo",
            workingHours: input.workingHours,
          })
          .returning();

        return newSettings;
      }

      // Atualizar working hours
      const [updated] = await tenantDb
        .update(organizationSettings)
        .set({
          workingHours: input.workingHours,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    }),

  /**
   * Update messages (welcome and closing)
   */
  updateMessages: ownerProcedure
    .input(
      z.object({
        welcomeMessage: z.string().optional(),
        closingMessage: z.string().optional(),
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

      // Verificar se settings existe
      const [existing] = await tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        // Criar com messages fornecidas
        const [newSettings] = await tenantDb
          .insert(organizationSettings)
          .values({
            organizationId,
            timezone: "America/Sao_Paulo",
            welcomeMessage: input.welcomeMessage ?? null,
            closingMessage: input.closingMessage ?? null,
          })
          .returning();

        return newSettings;
      }

      // Atualizar messages
      const [updated] = await tenantDb
        .update(organizationSettings)
        .set({
          welcomeMessage: input.welcomeMessage ?? null,
          closingMessage: input.closingMessage ?? null,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    }),

  /**
   * Update preferences (rating, user name, phone digits)
   */
  updatePreferences: ownerProcedure
    .input(
      z.object({
        ratingEnabled: z.boolean(),
        includeUserName: z.boolean(),
        hidePhoneDigits: z.boolean(),
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

      // Verificar se settings existe
      const [existing] = await tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        // Criar com preferences fornecidas
        const [newSettings] = await tenantDb
          .insert(organizationSettings)
          .values({
            organizationId,
            timezone: "America/Sao_Paulo",
            ratingEnabled: input.ratingEnabled,
            includeUserName: input.includeUserName,
            hidePhoneDigits: input.hidePhoneDigits,
          })
          .returning();

        return newSettings;
      }

      // Atualizar preferences
      const [updated] = await tenantDb
        .update(organizationSettings)
        .set({
          ratingEnabled: input.ratingEnabled,
          includeUserName: input.includeUserName,
          hidePhoneDigits: input.hidePhoneDigits,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    }),

  /**
   * Update all settings at once
   */
  update: ownerProcedure
    .input(updateOrganizationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se settings existe
      const [existing] = await tenantDb
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, organizationId))
        .limit(1);

      if (!existing) {
        // Criar novo settings
        const [newSettings] = await tenantDb
          .insert(organizationSettings)
          .values({
            organizationId,
            ...input,
          })
          .returning();

        return newSettings;
      }

      // Atualizar settings
      const [updated] = await tenantDb
        .update(organizationSettings)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(organizationSettings.id, existing.id))
        .returning();

      return updated;
    }),
});
