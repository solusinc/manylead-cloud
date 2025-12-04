/**
 * Message Formatting Utilities
 *
 * Centraliza formatação de mensagens com assinatura de agente
 * para manter consistência entre WhatsApp, Cross-Org e outros canais.
 */

/**
 * Formata mensagem com assinatura do agente
 *
 * Formato WhatsApp: *NomeDoAgente*\nConteúdo da mensagem
 * Formato Cross-Org: **NomeDoAgente**\nConteúdo da mensagem
 *
 * @param agentName - Nome do agente que está enviando
 * @param content - Conteúdo da mensagem (sem assinatura)
 * @param format - Formato da assinatura: 'whatsapp' usa * (negrito simples), 'cross-org' usa ** (negrito duplo)
 * @returns Mensagem formatada com assinatura
 *
 * @example
 * formatMessageWithSignature("João Silva", "Olá, tudo bem?", "whatsapp")
 * // Returns: "*João Silva*\nOlá, tudo bem?"
 *
 * formatMessageWithSignature("João Silva", "Olá, tudo bem?", "cross-org")
 * // Returns: "**João Silva**\nOlá, tudo bem?"
 */
export function formatMessageWithSignature(
  agentName: string,
  content: string,
  format: 'whatsapp' | 'cross-org' = 'cross-org'
): string {
  const boldMarker = format === 'whatsapp' ? '*' : '**';
  return `${boldMarker}${agentName}${boldMarker}\n${content}`;
}

/**
 * Remove assinatura do agente do conteúdo da mensagem
 *
 * Remove tanto formato WhatsApp (*Nome*) quanto Cross-Org (**Nome**)
 *
 * @param content - Conteúdo com assinatura
 * @returns Conteúdo sem assinatura
 *
 * @example
 * removeSignatureFromMessage("**João Silva**\nOlá, tudo bem?")
 * // Returns: "Olá, tudo bem?"
 *
 * removeSignatureFromMessage("*João Silva*\nOlá, tudo bem?")
 * // Returns: "Olá, tudo bem?"
 */
export function removeSignatureFromMessage(content: string): string {
  // Remove tanto ** quanto * no início
  return content.replace(/^\*+.*?\*+\n/, '');
}

/**
 * Verifica se uma mensagem possui assinatura
 *
 * Detecta tanto formato WhatsApp (*Nome*) quanto Cross-Org (**Nome**)
 *
 * @param content - Conteúdo da mensagem
 * @returns true se possui assinatura, false caso contrário
 */
export function hasSignature(content: string): boolean {
  return /^\*+.*?\*+\n/.test(content);
}
