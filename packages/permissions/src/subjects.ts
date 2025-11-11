/**
 * Subjects representam os recursos do sistema que podem ser autorizados
 */
export type Subjects =
  | 'Organization' // Configurações da organização (/settings/general + /settings/new-organization)
  | 'Agent'        // Gerenciar membros/atendentes (/settings/agents)
  | 'Department'   // Gerenciar departamentos (/settings/departments)
  | 'Billing'      // Faturamento
  | 'all';

/**
 * Actions representam as operações que podem ser realizadas nos recursos
 */
export type Actions =
  | 'manage' // Todas as operações
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'invite'; // Ação especial para convidar membros
