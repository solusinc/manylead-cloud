import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import type { AppAbility, AgentRole } from './types';

/**
 * Define as abilities (permissões) baseado no role do usuário
 *
 * @param role - O role do agente (owner, admin, member)
 * @param userId - ID do usuário (opcional, usado para permissões específicas do usuário)
 * @returns Uma instância de AppAbility configurada
 *
 * @example
 * ```typescript
 * const ability = defineAbilitiesFor('owner');
 * ability.can('manage', 'all'); // true
 *
 * const memberAbility = defineAbilitiesFor('member', 'user-123');
 * memberAbility.can('read', 'Agent'); // true
 * memberAbility.can('delete', 'Agent'); // false
 * ```
 */
export function defineAbilitiesFor(
  role: AgentRole,
  userId?: string,
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(
    createMongoAbility,
  );

  switch (role) {
    case 'owner':
      // Proprietários têm acesso total a tudo
      can('manage', 'all');
      break;

    case 'admin':
      // Admins podem gerenciar organização, agentes e departamentos
      can('manage', 'Organization');
      can('manage', 'Agent');
      can('manage', 'Department');

      // Admins podem VER billing mas não gerenciar
      can('read', 'Billing');
      break;

    case 'member':
      // Membros só podem editar sua própria conta
      // Não têm acesso a nenhum módulo de /settings/ (exceto /settings/account)
      if (userId) {
        can('update', 'Agent', { userId });
      }
      break;
  }

  return build();
}
