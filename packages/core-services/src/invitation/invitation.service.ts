import { TRPCError } from "@trpc/server";
import { and, count, eq, gte, invitation, member, organization, user } from "@manylead/db";
import type { CatalogDB } from "@manylead/db";

const RATE_LIMIT_PER_HOUR = 10;

export class InvitationService {
  /**
   * Validar se email já é membro da organização
   */
  async validateNotExistingMember(
    db: CatalogDB,
    email: string,
    organizationId: string,
  ): Promise<void> {
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (!existingUser) return;

    const [existingMember] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.userId, existingUser.id),
          eq(member.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (existingMember) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Este email já é membro desta organização",
      });
    }
  }

  /**
   * Validar se já existe convite pendente
   */
  async validateNoDuplicatePending(
    db: CatalogDB,
    email: string,
    organizationId: string,
  ): Promise<{ existingInvitationId: string | null }> {
    const [existing] = await db
      .select({ id: invitation.id, expiresAt: invitation.expiresAt })
      .from(invitation)
      .where(
        and(
          eq(invitation.email, email),
          eq(invitation.organizationId, organizationId),
          eq(invitation.status, "pending"),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.expiresAt < new Date()) {
        return { existingInvitationId: existing.id };
      }
      throw new TRPCError({
        code: "CONFLICT",
        message: "Já existe um convite pendente para este email. Use reenviar.",
      });
    }
    return { existingInvitationId: null };
  }

  /**
   * Rate limiting por organização
   */
  async checkRateLimit(db: CatalogDB, organizationId: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [result] = await db
      .select({ count: count() })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, organizationId),
          gte(invitation.createdAt, oneHourAgo),
        ),
      );

    if (result && result.count >= RATE_LIMIT_PER_HOUR) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Limite de ${RATE_LIMIT_PER_HOUR} convites/hora atingido`,
      });
    }
  }

  /**
   * Reenviar convite - atualiza expiração
   */
  async resend(
    db: CatalogDB,
    invitationId: string,
    organizationId: string,
  ): Promise<{ email: string; organizationName: string }> {
    await this.checkRateLimit(db, organizationId);

    const [inv] = await db
      .select()
      .from(invitation)
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!inv) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Convite não encontrado",
      });
    }

    if (inv.status !== "pending") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Apenas convites pendentes podem ser reenviados",
      });
    }

    // Atualizar expiração (+7 dias)
    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
      .where(eq(invitation.id, invitationId));

    const [org] = await db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    return { email: inv.email, organizationName: org?.name ?? "Organização" };
  }
}

export const invitationService = new InvitationService();
