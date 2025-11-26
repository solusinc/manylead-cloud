import { create } from "zustand";

interface MessageFocusState {
  // ID da mensagem a ser focada
  focusMessageId: string | null;
  // ID do chat da mensagem (para validação)
  focusChatId: string | null;
  // Ação para setar mensagem a focar
  setFocusMessage: (chatId: string, messageId: string) => void;
  // Ação para limpar foco
  clearFocus: () => void;
}

export const useMessageFocusStore = create<MessageFocusState>((set) => ({
  focusMessageId: null,
  focusChatId: null,

  setFocusMessage: (chatId, messageId) =>
    set({
      focusChatId: chatId,
      focusMessageId: messageId,
    }),

  clearFocus: () =>
    set({
      focusChatId: null,
      focusMessageId: null,
    }),
}));
