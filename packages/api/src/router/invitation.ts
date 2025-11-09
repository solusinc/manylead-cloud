import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

/**
 * Invitation Router
 *
 * Gerencia convites para organizações usando Better Auth APIs.
 */
export const invitationRouter = createTRPCRouter({
  /**
   * List user invitations
   * Lista convites pendentes do usuário atual
   */
  listUserInvitations: protectedProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.authApi.listUserInvitations({
      headers: ctx.headers,
    });

    return invitations;
  }),

  /**
   * Accept invitation
   * Aceita um convite pendente
   */
  accept: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.authApi.acceptInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      });

      return result;
    }),

  /**
   * Reject invitation
   * Rejeita um convite pendente
   */
  reject: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.authApi.rejectInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      });

      return result;
    }),
});
