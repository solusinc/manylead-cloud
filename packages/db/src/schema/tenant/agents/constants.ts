/**
 * Access types for permissions
 */
export const accessTypes = ["all", "specific"] as const;

/**
 * Agent roles (espelhado do Better Auth)
 * - owner: Proprietário - Full access + financeiro
 * - admin: Admin - Full access - financeiro
 * - member: Membro - Atendimento e visualização
 */
export const agentRoles = ["owner", "admin", "member"] as const;
