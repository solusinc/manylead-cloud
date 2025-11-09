import { createTRPCRouter, protectedProcedure } from "../trpc";

/**
 * Organization Router
 *
 * Usa Better Auth para gerenciar organizations, members e invitations.
 * O TenantDatabaseManager é integrado via hooks no Better Auth.
 */
export const organizationRouter = createTRPCRouter({
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
});
