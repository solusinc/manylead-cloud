import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  department,
  insertDepartmentSchema,
  updateDepartmentSchema,
} from "@manylead/db";

import { createTRPCRouter, protectedProcedure, tenantManager } from "../trpc";

/**
 * Departments Router
 *
 * Gerencia departamentos do tenant (Vendas, Suporte, etc.)
 */
export const departmentsRouter = createTRPCRouter({
  /**
   * List all departments for the active organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.session.session.activeOrganizationId;

    if (!organizationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa",
      });
    }

    const tenantDb = await tenantManager.getConnection(organizationId);

    const departments = await tenantDb
      .select()
      .from(department)
      .where(eq(department.organizationId, organizationId))
      .orderBy(department.name);

    return departments;
  }),

  /**
   * Get department by ID
   */
  getById: protectedProcedure
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

      const [dept] = await tenantDb
        .select()
        .from(department)
        .where(
          and(
            eq(department.id, input.id),
            eq(department.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!dept) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Departamento não encontrado",
        });
      }

      return dept;
    }),

  /**
   * Create a new department
   */
  create: protectedProcedure
    .input(insertDepartmentSchema.omit({ organizationId: true }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.session.activeOrganizationId;

      if (!organizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa",
        });
      }

      const tenantDb = await tenantManager.getConnection(organizationId);

      // Verificar se já existe departamento com mesmo nome
      const [existing] = await tenantDb
        .select()
        .from(department)
        .where(
          and(
            eq(department.organizationId, organizationId),
            eq(department.name, input.name),
          ),
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Já existe um departamento com o nome '${input.name}'`,
        });
      }

      const [newDept] = await tenantDb
        .insert(department)
        .values({
          ...input,
          organizationId,
        })
        .returning();

      return newDept;
    }),

  /**
   * Update a department
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateDepartmentSchema,
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

      // Verificar se departamento existe
      const [existing] = await tenantDb
        .select()
        .from(department)
        .where(
          and(
            eq(department.id, input.id),
            eq(department.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Departamento não encontrado",
        });
      }

      // Se estiver mudando o nome, verificar se não conflita
      if (input.data.name && input.data.name !== existing.name) {
        const [nameConflict] = await tenantDb
          .select()
          .from(department)
          .where(
            and(
              eq(department.organizationId, organizationId),
              eq(department.name, input.data.name),
            ),
          )
          .limit(1);

        if (nameConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Já existe um departamento com o nome '${input.data.name}'`,
          });
        }
      }

      const [updated] = await tenantDb
        .update(department)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(department.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete a department
   */
  delete: protectedProcedure
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

      // Verificar se departamento existe
      const [existing] = await tenantDb
        .select()
        .from(department)
        .where(
          and(
            eq(department.id, input.id),
            eq(department.organizationId, organizationId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Departamento não encontrado",
        });
      }

      await tenantDb.delete(department).where(eq(department.id, input.id));

      return { success: true };
    }),
});
