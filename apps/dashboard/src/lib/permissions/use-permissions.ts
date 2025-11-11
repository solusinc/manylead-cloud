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

  // Determinar role baseado nas permissões
  const isOwner = ability.can('manage', 'Billing');
  const isAdmin =
    ability.can('manage', 'Agent') && ability.cannot('manage', 'Billing');
  const isMember = ability.cannot('manage', 'Agent');

  return {
    // Role info
    isOwner,
    isAdmin,
    isMember,

    // Agent permissions
    canInviteMember: ability.can('invite', 'Agent') || ability.can('manage', 'Agent'),
    canEditAgent: (_agent) => ability.can('manage', 'Agent'),
    canEditAgentRole: ability.can('manage', 'Agent'),
    canDeleteAgent: (_agent) => ability.can('delete', 'Agent'),

    // Billing permissions
    canAccessBilling: ability.can('read', 'Billing'),
    canManageBilling: ability.can('manage', 'Billing'),

    // Department permissions
    canCreateDepartment: ability.can('create', 'Department'),
    canEditDepartment: ability.can('update', 'Department'),
    canDeleteDepartment: ability.can('delete', 'Department'),

    // Organization permissions
    canAccessSettings: ability.can('read', 'Organization'),
    canEditSettings: ability.can('update', 'Organization'),

    // Generic check
    can: (action, subject, field) =>
      ability.can(action as never, subject as never, field),
  };
}
