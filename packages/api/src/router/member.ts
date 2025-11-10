import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { member, session, user } from "@manylead/db";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const memberRouter = createTRPCRouter({
  /**
   * List all members of the active organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const activeOrgId = ctx.session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa encontrada",
      });
    }

    const members = await ctx.db
      .select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          createdAt: user.createdAt,
        },
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, activeOrgId));

    return members;
  }),

  /**
   * Remove a member from the organization
   * Only owners can remove members
   * Cannot remove yourself
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Check current user's role
      const currentUserMember = await ctx.db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, ctx.session.user.id),
            eq(member.organizationId, activeOrgId),
          ),
        )
        .limit(1);

      if (!currentUserMember[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Você não é membro desta organização",
        });
      }

      if (currentUserMember[0].role !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Apenas proprietários podem remover membros",
        });
      }

      // Cannot remove yourself
      if (input.id === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode remover a si mesmo da organização",
        });
      }

      // Get the member being removed to check their role
      const memberToRemove = await ctx.db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, input.id),
            eq(member.organizationId, activeOrgId),
          ),
        )
        .limit(1);

      if (!memberToRemove[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Membro não encontrado",
        });
      }

      // Cannot remove owner
      if (memberToRemove[0].role === "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Não é possível remover o proprietário da organização",
        });
      }

      // Check if user has other organizations
      const otherOrganizations = await ctx.db
        .select()
        .from(member)
        .where(
          and(
            eq(member.userId, input.id),
            ne(member.organizationId, activeOrgId),
          ),
        )
        .limit(1);

      // Delete the member
      await ctx.db
        .delete(member)
        .where(
          and(
            eq(member.organizationId, activeOrgId),
            eq(member.userId, input.id),
          ),
        );

      // If user has other organizations, update active organization in sessions
      // Otherwise, revoke all sessions
      if (otherOrganizations.length > 0 && otherOrganizations[0]) {
        const newActiveOrgId = otherOrganizations[0].organizationId;
        await ctx.db
          .update(session)
          .set({ activeOrganizationId: newActiveOrgId })
          .where(eq(session.userId, input.id));
      } else {
        await ctx.db
          .update(session)
          .set({ activeOrganizationId: null })
          .where(eq(session.userId, input.id));
        // User has no more organizations, revoke all sessions
        // await ctx.db.delete(session).where(eq(session.userId, input.id));
      }
    }),
});
