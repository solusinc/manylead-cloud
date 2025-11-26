/**
 * Quick Reply Constants
 */

/**
 * Tipos de conteúdo suportados pelo quick reply
 */
export const QUICK_REPLY_CONTENT_TYPES = [
  "text",
  "image",
  "audio",
  "document",
  "location",
] as const;

export type QuickReplyContentType = (typeof QUICK_REPLY_CONTENT_TYPES)[number];

/**
 * Opções de visibilidade
 */
export const QUICK_REPLY_VISIBILITY = [
  "organization", // Para todos na organização
  "private", // Apenas para o criador
] as const;

export type QuickReplyVisibility = (typeof QUICK_REPLY_VISIBILITY)[number];

/**
 * Variáveis disponíveis para substituição
 */
export const QUICK_REPLY_VARIABLES = [
  "{{contact.name}}",
  "{{agent.name}}",
  "{{organization.name}}",
] as const;

/**
 * Labels para visibilidade (para UI)
 */
export const QUICK_REPLY_VISIBILITY_LABELS: Record<QuickReplyVisibility, string> = {
  organization: "Para todos",
  private: "Apenas para mim",
};

/**
 * Labels para tipos de conteúdo (para UI)
 */
export const QUICK_REPLY_CONTENT_TYPE_LABELS: Record<QuickReplyContentType, string> = {
  text: "Texto",
  image: "Imagem",
  audio: "Áudio",
  document: "Documento",
  location: "Localização",
};

/**
 * Interface para uma mensagem individual dentro de um quick reply
 */
export interface QuickReplyMessage {
  type: QuickReplyContentType;
  content: string; // Para texto: conteúdo; Para mídia: caption/descrição

  // Campos para mídia (image, audio, document)
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaMimeType?: string | null;

  // Campos para localização
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null; // Nome do local (ex: "Escritório XYZ")
  locationAddress?: string | null; // Endereço completo
}
