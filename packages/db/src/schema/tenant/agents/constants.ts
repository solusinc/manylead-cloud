/**
 * Access types for permissions
 */
export const accessTypes = ["all", "specific"] as const;

/**
 * Agent roles (espelhado do Better Auth)
 * - owner: Administrador - Acessa todas as conversas. Gerencia todas as configurações.
 * - admin: Supervisor - Acessa todas as conversas. Gerencia apenas "contatos" e "respostas rápidas"
 * - member: Agente - Acessa apenas suas próprias conversas.
 */
export const agentRoles = ["owner", "admin", "member"] as const;
