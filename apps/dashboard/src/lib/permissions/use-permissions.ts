'use client';

import { useAbility } from './ability-context';

export interface UsePermissionsReturn {
  // Role checks
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;

  // Agent permissions
  canInviteMember: boolean;
  canEditAgent: (agent: { userId: string }) => boolean;
  canEditAgentRole: boolean;
  canDeleteAgent: (agent: { userId: string }) => boolean;

  // Billing permissions
  canAccessBilling: boolean;
  canManageBilling: boolean;

  // Department permissions
  canCreateDepartment: boolean;
  canEditDepartment: boolean;
  canDeleteDepartment: boolean;

  // Settings permissions
  canAccessSettings: boolean;
  canEditSettings: boolean;

  // Generic permission check
  can: (action: string, subject: string, field?: string) => boolean;
}

/**
 * Hook customizado que fornece helpers imperativos para verificar permissões
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { canInviteMember, isOwner } = usePermissions();
 *
 *   return (
 *     <div>
 *       {canInviteMember && <Button>Convidar Membro</Button>}
 *       {isOwner && <Badge>Owner</Badge>}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const ability = useAbility();

  // Determinar role baseado nas permissões da nova estrutura:
  // - Administrador (owner): manage all
  // - Supervisor (admin): manage Contact/QuickReply/Tag, mas NÃO manage Organization/Agent/Department
  // - Agente (member): apenas read Conversation com assignedTo
  const isOwner = ability.can('manage', 'Organization');
  const isAdmin =
    ability.can('manage', 'Contact') && ability.cannot('manage', 'Organization');
  const isMember = ability.cannot('manage', 'Contact');

  return {
    // Role info
    isOwner,
    isAdmin,
    isMember,

    // Agent permissions - Apenas Administrador pode gerenciar usuários
    canInviteMember: ability.can('manage', 'Agent'),
    canEditAgent: (_agent) => ability.can('manage', 'Agent'),
    canEditAgentRole: ability.can('manage', 'Agent'),
    canDeleteAgent: (_agent) => ability.can('manage', 'Agent'),

    // Billing permissions - Apenas Administrador tem acesso
    canAccessBilling: ability.can('read', 'Billing'),
    canManageBilling: ability.can('manage', 'Billing'),

    // Department permissions - Apenas Administrador pode gerenciar departamentos
    canCreateDepartment: ability.can('manage', 'Department'),
    canEditDepartment: ability.can('manage', 'Department'),
    canDeleteDepartment: ability.can('manage', 'Department'),

    // Organization permissions - Apenas Administrador pode gerenciar configurações
    canAccessSettings: ability.can('manage', 'Organization'),
    canEditSettings: ability.can('manage', 'Organization'),

    // Generic check
    can: (action, subject, field) =>
      ability.can(action as never, subject as never, field),
  };
}
