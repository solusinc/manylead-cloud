import { agent, eq } from "@manylead/db";
import type { TenantDB, Chat } from "@manylead/db";
import { TRPCError } from "@trpc/server";
import type { AgentContext } from "./chat.types";

/**
 * Chat Permissions Service
 *
 * Responsabilidades:
 * - Buscar agent do usuário logado (elimina 240 linhas de duplicação)
 * - Verificar permissões de acesso a chats
 * - Aplicar filtros baseados em role
 *
 * Service stateless - recebe tenantDb no constructor
 */
export class ChatPermissionsService {
  constructor(private tenantDb: TenantDB) {}

  /**
   * Buscar agent do usuário logado
   *
   * Centraliza lógica repetida 12+ vezes no router
   *
   * @throws {TRPCError} NOT_FOUND se agent não encontrado
   */
  async getCurrentAgent(userId: string): Promise<AgentContext> {
    const [currentAgent] = await this.tenantDb
      .select()
      .from(agent)
      .where(eq(agent.userId, userId))
      .limit(1);

    if (!currentAgent) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Agent não encontrado",
      });
    }

    return currentAgent as AgentContext;
  }

  /**
   * Verificar se agent pode modificar chat
   *
   * Owner/Admin: podem modificar qualquer chat
   * Member: apenas chats atribuídos a ele
   */
  canModifyChat(agent: AgentContext, chat: Chat): boolean {
    if (agent.role === "owner" || agent.role === "admin") {
      return true;
    }

    return chat.assignedTo === agent.id;
  }

  /**
   * Verificar permissão e lançar erro se não autorizado
   *
   * Centraliza lógica repetida 5 vezes no router
   *
   * @throws {TRPCError} FORBIDDEN se sem permissão
   */
  requireModifyPermission(agent: AgentContext, chat: Chat): void {
    if (!this.canModifyChat(agent, chat)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Apenas o agent responsável pelo atendimento pode modificar este chat",
      });
    }
  }

  /**
   * Verificar se agent pode acessar chat
   *
   * Owner/Admin: acessam qualquer chat
   * Member: apenas chats pending OU atribuídos a ele
   */
  canAccessChat(agent: AgentContext, chat: Chat): boolean {
    if (agent.role === "owner" || agent.role === "admin") {
      return true;
    }

    // Members veem chats pending ou atribuídos a eles
    return chat.status === "pending" || chat.assignedTo === agent.id;
  }

  /**
   * Verificar se agent pode acessar departamento
   *
   * Usado para filtrar chats por departamento baseado em permissões
   */
  canAccessDepartment(agent: AgentContext, departmentId: string): boolean {
    if (agent.permissions.departments.type === "all") {
      return true;
    }

    return agent.permissions.departments.ids?.includes(departmentId) ?? false;
  }

  /**
   * Verificar se agent pode acessar chats finalizados
   *
   * Usado para filtrar chats closed baseado em permissão
   */
  canAccessFinishedChats(agent: AgentContext): boolean {
    return (
      agent.role === "owner" ||
      agent.role === "admin" ||
      agent.permissions.accessFinishedChats
    );
  }
}
