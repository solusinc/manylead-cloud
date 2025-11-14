/**
 * Subjects representam os recursos do sistema que podem ser autorizados
 */
export type Subjects =
  | 'Organization' // Configurações da organização (/settings/general + /settings/new-organization)
  | 'Agent'        // Gerenciar membros/atendentes (/settings/users)
  | 'Department'   // Gerenciar departamentos (/settings/departments)
  | 'Channel'      // Gerenciar canais WhatsApp (/settings/channels)
  | 'Conversation' // Conversas com contatos
  | 'Contact'      // Contatos da organização
  | 'QuickReply'   // Respostas rápidas
  | 'Tag'          // Tags para organização
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
