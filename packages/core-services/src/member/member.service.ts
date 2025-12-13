import { TRPCError } from "@trpc/server";
import { agent, chat, eq, member } from "@manylead/db";
import type { CatalogDB, TenantDB } from "@manylead/db";
import type { Auth } from "@manylead/auth";

export class MemberService {
  /**
   * Remove membro com limpeza completa
   * 1. Desatribui chats ativos (voltam para fila)
   * 2. Deleta agent do tenant
   * 3. Remove member do catalog via Better Auth
   */
  async removeMemberWithCleanup(params: {
    catalogDb: CatalogDB;
    tenantDb: TenantDB;
    memberId: string;
    organizationId: string;
    authApi: Auth["api"];
    headers: Headers;
  }): Promise<void> {
    const { catalogDb, tenantDb, memberId, authApi, headers } = params;

    // 1. Buscar member
    const [memberRecord] = await catalogDb
      .select()
      .from(member)
      .where(eq(member.id, memberId))
      .limit(1);

    if (!memberRecord) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Membro não encontrado",
      });
    }

    // 2. Buscar agent correspondente
    const [agentRecord] = await tenantDb
      .select()
      .from(agent)
      .where(eq(agent.userId, memberRecord.userId))
      .limit(1);

    // 3. Desatribuir chats ativos (voltam para fila)
    if (agentRecord) {
      await tenantDb
        .update(chat)
        .set({ assignedTo: null })
        .where(eq(chat.assignedTo, agentRecord.id));

      // 4. Deletar agent (cascade: chatParticipant, agentStatus)
      await tenantDb.delete(agent).where(eq(agent.id, agentRecord.id));
    }

    // 5. Remover member via Better Auth
    await authApi.removeMember({
      body: { memberIdOrEmail: memberId },
      headers,
    });
  }
}

export const memberService = new MemberService();
