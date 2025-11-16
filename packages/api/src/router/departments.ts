import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  department,
  eq,
  insertDepartmentSchema,
  selectDepartmentSchema,
  updateDepartmentSchema,
} from "@manylead/db";

import { createTRPCRouter, ownerProcedure, tenantManager } from "../trpc";

/**
 * Departments Router
 *
 * Gerencia departamentos do tenant (Vendas, Suporte, etc.)
 */
export const departmentsRouter = createTRPCRouter({
  /**
   * List all departments for the active organization
   */
  list: ownerProcedure.query(async ({ ctx }) => {
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
  getById: ownerProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      // ctx.tenantDb já está disponível via ownerProcedure
      // organizationId já foi validado pelo middleware

      const [dept] = await ctx.tenantDb
        .select()
        .from(department)
        .where(eq(department.id, input.id))
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
   * Only admins and owners can create departments (enforced by ownerProcedure)
   */
  create: ownerProcedure
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
   * Only admins and owners can update departments (enforced by ownerProcedure)
   */
  update: ownerProcedure
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
   * Only admins and owners can update departments (enforced by ownerProcedure)
   */
  updateDepartments: ownerProcedure
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
   * Only admins and owners can delete departments (enforced by ownerProcedure)
   */
  deleteDepartments: ownerProcedure
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
   * Only admins and owners can delete departments (enforced by ownerProcedure)
   */
  delete: ownerProcedure
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
