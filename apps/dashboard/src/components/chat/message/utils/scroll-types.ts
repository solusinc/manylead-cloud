export type ScrollBehavior = "instant" | "smooth" | "auto";

export type ScrollTrigger =
  | "initial_load"           // Primeira carga
  | "own_message"            // Mensagem enviada pelo agent
  | "system_message"         // Mensagem de sistema
  | "received_message"       // Mensagem recebida do contato
  | "typing_indicator"       // Indicador de digitação
  | "recording_indicator"    // Indicador de gravação
  | "chat_updated"           // Chat transferido/finalizado
  | "image_load_recent"      // Imagem carregou (últimas 5)
  | "image_load_old"         // Imagem carregou (antigas)
  | "manual_button";         // Clique no botão

export interface ScrollContext {
  isLoadingOlder: boolean;
  isNearBottom: boolean;
  distanceFromBottom: number;
  messageIndex: number;
  totalMessages: number;
}

export interface AnchorState {
  messageId: string | null;
  offsetFromTop: number;
  savedScrollTop: number;
}
