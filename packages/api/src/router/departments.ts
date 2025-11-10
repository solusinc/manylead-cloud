import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import {
  department,
  insertDepartmentSchema,
  selectDepartmentSchema,
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

    return departments.map((dept) => selectDepartmentSchema.parse(dept));
  }),

  /**
   * Get department by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
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

      return selectDepartmentSchema.parse(dept);
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
        id: z.uuid(),
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
   * Update multiple departments
   */
  updateDepartments: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.uuid()),
        isActive: z.boolean(),
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

      // Atualizar todos os departamentos
      await Promise.all(
        input.ids.map((id) =>
          tenantDb
            .update(department)
            .set({
              isActive: input.isActive,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(department.id, id),
                eq(department.organizationId, organizationId),
              ),
            ),
        ),
      );

      return { success: true };
    }),

  /**
   * Delete multiple departments
   */
  deleteDepartments: protectedProcedure
    .input(
      z.object({
        ids: z.array(z.uuid()),
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

      // Deletar todos os departamentos
      await Promise.all(
        input.ids.map((id) =>
          tenantDb
            .delete(department)
            .where(
              and(
                eq(department.id, id),
                eq(department.organizationId, organizationId),
              ),
            ),
        ),
      );

      return { success: true };
    }),

  /**
   * Delete a department
   */
  delete: protectedProcedure
    .input(z.object({ id: z.uuid() }))
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
