import {
  createTRPCRouter,
  protectedProcedure,
  ownerProcedure,
  tenantManager,
} from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { invitation, organization, agent } from "@manylead/db";
import { EmailClient } from "@manylead/emails";
import { env } from "../env";

const emailClient = new EmailClient({
  apiKey: env.RESEND_API_KEY,
});

const BASE_URL = env.NEXT_PUBLIC_APP_URL;

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
   * Get invitation by token
   * Busca convite pelo token
   */
  get: protectedProcedure
    .input(z.object({ token: z.string().nullable() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Você não está autorizado a acessar este recurso.",
        });
      }

      if (!input.token) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Token é obrigatório.",
        });
      }

      const result = await ctx.db.query.invitation.findFirst({
        where: and(
          eq(invitation.id, input.token),
          eq(invitation.email, ctx.session.user.email),
          eq(invitation.status, "pending"),
          gte(invitation.expiresAt, new Date()),
        ),
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado ou expirado.",
        });
      }

      // Get organization data
      const org = await ctx.db
        .select()
        .from(organization)
        .where(eq(organization.id, result.organizationId))
        .limit(1);

      return {
        ...result,
        organization: org[0],
      };
    }),

  /**
   * Accept invitation
   * Aceita um convite pendente e cria o agent automaticamente
   */
  accept: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get invitation data before accepting
      const inv = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);

      if (!inv[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado",
        });
      }

      const organizationId = inv[0].organizationId;

      // Accept invitation (Better Auth creates member automatically)
      const result = await ctx.authApi.acceptInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      });

      // Create agent in tenant database with role and permissions from invitation
      const tenantDb = await tenantManager.getConnection(organizationId);

      // Check if agent already exists
      const [existingAgent] = await tenantDb
        .select()
        .from(agent)
        .where(eq(agent.userId, ctx.session.user.id))
        .limit(1);

      if (!existingAgent) {
        // Pegar department access do metadata da invitation
        const metadata = inv[0].metadata as
          | {
              departmentAccess?: "all" | "specific";
              departmentIds?: string[];
            }
          | null
          | undefined;

        const departmentAccess = metadata?.departmentAccess ?? "all";
        const departmentIds = metadata?.departmentIds ?? [];

        await tenantDb.insert(agent).values({
          userId: ctx.session.user.id,
          role: inv[0].role ?? "member", // Use role from invitation
          permissions: {
            departments:
              departmentAccess === "specific"
                ? { type: "specific", ids: departmentIds }
                : { type: "all" },
            channels: { type: "all" },
          },
          isActive: true,
        });
      }

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

  /**
   * Create a new invitation and send email
   * Only admins and owners can create invitations (enforced by ownerProcedure)
   */
  create: ownerProcedure
    .input(
      z.object({
        email: z.string().email("Email inválido"),
        role: z.enum(["owner", "admin", "member"]).default("member"),
        departmentAccess: z.enum(["all", "specific"]).default("all"),
        departmentIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Validar que departmentIds está presente quando departmentAccess é "specific"
      if (
        input.departmentAccess === "specific" &&
        (!input.departmentIds || input.departmentIds.length === 0)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Selecione pelo menos um departamento",
        });
      }

      // Get organization data
      const org = await ctx.db
        .select()
        .from(organization)
        .where(eq(organization.id, activeOrgId))
        .limit(1);

      if (!org[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organização não encontrada",
        });
      }

      // Create invitation using Better Auth
      const newInvitation = await ctx.authApi.createInvitation({
        body: {
          email: input.email,
          organizationId: activeOrgId,
          role: input.role,
        },
        headers: ctx.headers,
      });

      if (!newInvitation.id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Falha ao criar convite",
        });
      }

      // Atualizar invitation com metadata de department access
      await ctx.db
        .update(invitation)
        .set({
          metadata: {
            departmentAccess: input.departmentAccess,
            departmentIds: input.departmentIds ?? [],
          },
        })
        .where(eq(invitation.id, newInvitation.id));

      // Send invitation email
      // TODO: O token de convite é válido por 1 semana (expiresAt definido pelo Better Auth)
      await emailClient.sendTeamInvitation({
        to: input.email,
        token: newInvitation.id,
        organizationName: org[0].name,
        invitedBy: ctx.session.user.email,
        baseUrl: `${BASE_URL}/invite`,
      });

      if (env.NODE_ENV === "development") {
        console.log(
          `>>>> Invitation link: ${BASE_URL}/invite?token=${newInvitation.id} <<<<`,
        );
      }

      return newInvitation;
    }),

  /**
   * List all pending invitations for the active organization
   */
  list: ownerProcedure.query(async ({ ctx }) => {
    const activeOrgId = ctx.session.session.activeOrganizationId;

    if (!activeOrgId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Nenhuma organização ativa encontrada",
      });
    }

    const invitations = await ctx.db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, activeOrgId),
          gte(invitation.expiresAt, new Date()),
          eq(invitation.status, "pending"),
        ),
      );

    return invitations;
  }),

  /**
   * Get invitation by ID
   * Only admins and owners can get invitation details (enforced by ownerProcedure)
   */
  getById: ownerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      const inv = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.id))
        .limit(1);

      if (!inv[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado",
        });
      }

      if (inv[0].organizationId !== activeOrgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para visualizar este convite",
        });
      }

      return inv[0];
    }),

  /**
   * Update invitation
   * Only admins and owners can update invitations (enforced by ownerProcedure)
   */
  update: ownerProcedure
    .input(
      z.object({
        id: z.string(),
        role: z.enum(["owner", "admin", "member"]).optional(),
        departmentAccess: z.enum(["all", "specific"]).optional(),
        departmentIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Verify the invitation belongs to the active organization
      const inv = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.id))
        .limit(1);

      if (!inv[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado",
        });
      }

      if (inv[0].organizationId !== activeOrgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para editar este convite",
        });
      }

      // Validar que departmentIds está presente quando departmentAccess é "specific"
      if (
        input.departmentAccess === "specific" &&
        (!input.departmentIds || input.departmentIds.length === 0)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selecione pelo menos um departamento",
        });
      }

      // Parse metadata existente
      const currentMetadata = (inv[0].metadata ?? {}) as {
        departmentAccess?: string;
        departmentIds?: string[];
      };

      // Construir novo metadata
      const newMetadata = {
        departmentAccess: input.departmentAccess ?? currentMetadata.departmentAccess ?? "all",
        departmentIds:
          input.departmentAccess === "specific"
            ? input.departmentIds
            : input.departmentAccess === "all"
              ? []
              : currentMetadata.departmentIds ?? [],
      };

      // Update invitation
      await ctx.db
        .update(invitation)
        .set({
          role: input.role ?? inv[0].role,
          metadata: newMetadata,
        })
        .where(eq(invitation.id, input.id));

      return { success: true };
    }),

  /**
   * Delete an invitation
   * Only admins and owners can delete invitations (enforced by ownerProcedure)
   */
  delete: ownerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const activeOrgId = ctx.session.session.activeOrganizationId;

      if (!activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Nenhuma organização ativa encontrada",
        });
      }

      // Verify the invitation belongs to the active organization
      const inv = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.id))
        .limit(1);

      if (!inv[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Convite não encontrado",
        });
      }

      if (inv[0].organizationId !== activeOrgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para deletar este convite",
        });
      }

      await ctx.db.delete(invitation).where(eq(invitation.id, input.id));
    }),
});
