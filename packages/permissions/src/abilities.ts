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
      // Administradores têm acesso total a tudo
      can('manage', 'all');
      break;

    case 'admin':
      // Supervisores podem visualizar todas as conversas
      can('read', 'Conversation');
      can('update', 'Conversation'); // Atribuir conversas

      // Supervisores podem gerenciar contatos
      can('manage', 'Contact');

      // Supervisores podem gerenciar respostas rápidas
      can('manage', 'QuickReply');

      // Supervisores podem gerenciar tags
      can('manage', 'Tag');

      // Supervisores NÃO podem gerenciar organização, usuários ou departamentos
      // Supervisores NÃO têm acesso ao billing
      break;

    case 'member':
      // Agentes só podem ver conversas atribuídas a eles
      if (userId) {
        can('read', 'Conversation', { assignedTo: userId });
        can('update', 'Conversation', { assignedTo: userId });

        // Agentes podem editar seu próprio perfil
        can('update', 'Agent', { userId });
      }

      // Agentes NÃO podem gerenciar contatos, respostas rápidas ou configurações
      break;
  }

  return build();
}
