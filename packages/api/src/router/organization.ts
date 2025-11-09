import { TRPCError } from "@trpc/server";
import slugify from "slugify";
import { z } from "zod";

import { eq } from "drizzle-orm";
import {
  insertOrganizationSchema,
  organizationMembers,
  organizations,
} from "@manylead/db";
import { TenantDatabaseManager } from "@manylead/tenant-db";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const tenantManager = new TenantDatabaseManager();

export const organizationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      insertOrganizationSchema.pick({
        name: true,
        description: true,
      }),
    )
    .mutation(async (opts) => {
      const { name, description } = opts.input;

      // Generate unique slug
      let slug = slugify(name, { lower: true, strict: true });
      let slugExists = await tenantManager.getTenantBySlug(slug);
      let counter = 1;

      while (slugExists) {
        slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
        slugExists = await tenantManager.getTenantBySlug(slug);
        counter++;
      }

      // Provision tenant database
      const tenant = await tenantManager.provisionTenant({
        organizationId: crypto.randomUUID(),
        slug,
        name,
      });

      // Get tenant database connection
      const tenantDb = await tenantManager.getConnection(tenant.organizationId);

      // Create organization in tenant database
      const [organization] = await tenantDb
        .insert(organizations)
        .values({
          id: tenant.organizationId,
          name,
          slug,
          description,
        })
        .returning();

      if (!organization) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create organization",
        });
      }

      // Add current user as owner
      await tenantDb.insert(organizationMembers).values({
        organizationId: organization.id,
        userId: opts.ctx.session.user.id,
        role: "owner",
      });

      return organization;
    }),

  getUserOrganizations: protectedProcedure.query(() => {
    // TODO: Implement proper user organizations query
    // For now, return empty array as we need to implement proper tenant membership tracking
    return [];
  }),

  getMembers: protectedProcedure
    .input(z.object({ organizationId: z.string().uuid() }))
    .query(async (opts) => {
      const tenantDb = await tenantManager.getConnection(
        opts.input.organizationId,
      );

      const members = await tenantDb
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, opts.input.organizationId));

      return members;
    }),

  update: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        name: z.string().min(3).max(255).optional(),
        description: z.string().max(1000).optional(),
        logo: z.string().url().optional(),
        settings: z
          .object({
            language: z.string(),
            dateFormat: z.string(),
          })
          .optional(),
      }),
    )
    .mutation(async (opts) => {
      const tenantDb = await tenantManager.getConnection(
        opts.input.organizationId,
      );

      // Verify user is owner
      const [membership] = await tenantDb
        .select()
        .from(organizationMembers)
        .where(
          eq(organizationMembers.organizationId, opts.input.organizationId),
        )
        .limit(1);

      if (!membership?.role || membership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can update organization",
        });
      }

      const { organizationId, ...updateData } = opts.input;

      await tenantDb
        .update(organizations)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .mutation(async (opts) => {
      const tenantDb = await tenantManager.getConnection(
        opts.input.organizationId,
      );

      // Verify requester is owner
      const [requesterMembership] = await tenantDb
        .select()
        .from(organizationMembers)
        .where(
          eq(organizationMembers.organizationId, opts.input.organizationId),
        )
        .limit(1);

      if (!requesterMembership?.role || requesterMembership.role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can remove members",
        });
      }

      // Cannot remove yourself
      if (opts.input.userId === opts.ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove yourself from organization",
        });
      }

      await tenantDb
        .delete(organizationMembers)
        .where(
          eq(organizationMembers.userId, opts.input.userId),
        );
    }),
});
