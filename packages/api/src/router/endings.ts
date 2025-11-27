import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  ending,
  eq,
  insertEndingSchema,
  selectEndingSchema,
  updateEndingSchema,
} from "@manylead/db";

import { createTRPCRouter, adminProcedure, memberProcedure, ownerProcedure, tenantManager } from "../trpc";

/**
 * Endings Router
 *
 * Gerencia motivos de finalização de atendimentos
 */
export const endingsRouter = createTRPCRouter({
  /**
   * List all endings for the active organization
   */
  list: memberProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const endings = await tenantDb
      .select()
      .from(ending)
      .where(eq(ending.organizationId, organizationId))
      .orderBy(ending.title);

    return endings.map((e) => selectEndingSchema.parse(e));
  }),

  /**
   * Get ending by ID
   */
  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      const [result] = await tenantDb
        .select()
        .from(ending)
        .where(and(eq(ending.id, input.id), eq(ending.organizationId, organizationId)))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Motivo de finalização não encontrado",
        });
      }

      return selectEndingSchema.parse(result);
    }),

  /**
   * Create a new ending
   */
  create: ownerProcedure
    .input(insertEndingSchema.omit({ organizationId: true }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe ending com mesmo título
      const [existing] = await tenantDb
        .select()
        .from(ending)
        .where(and(eq(ending.organizationId, organizationId), eq(ending.title, input.title)))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe um motivo de finalização com o título '${input.title}'`,
        });
      }

      const [newEnding] = await tenantDb
        .insert(ending)
        .values({
          ...input,
          organizationId,
        })
        .returning();

      return newEnding;
    }),

  /**
   * Update an ending
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateEndingSchema,
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

      // Verificar se ending existe
      const [existing] = await tenantDb
        .select()
        .from(ending)
        .where(and(eq(ending.id, input.id), eq(ending.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Motivo de finalização não encontrado",
        });
      }

      // Se estiver mudando o título, verificar se não conflita
      if (input.data.title && input.data.title !== existing.title) {
        const [titleConflict] = await tenantDb
          .select()
          .from(ending)
          .where(and(eq(ending.organizationId, organizationId), eq(ending.title, input.data.title)))
          .limit(1);

        if (titleConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um motivo de finalização com o título '${input.data.title}'`,
          });
        }
      }

      const [updated] = await tenantDb
        .update(ending)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(ending.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete an ending
   */
  delete: ownerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se ending existe
      const [existing] = await tenantDb
        .select()
        .from(ending)
        .where(and(eq(ending.id, input.id), eq(ending.organizationId, organizationId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Motivo de finalização não encontrado",
        });
      }

      await tenantDb.delete(ending).where(eq(ending.id, input.id));

      return { success: true };
    }),
});
