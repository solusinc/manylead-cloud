import { create } from "zustand";

interface ChatFiltersState {
  isOpen: boolean;
  showUnreadOnly: boolean;
  open: () => void;
  close: () => void;
  toggleUnreadOnly: () => void;
  resetUnreadOnly: () => void;
}

export const useChatFiltersStore = create<ChatFiltersState>((set) => ({
  isOpen: false,
  showUnreadOnly: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleUnreadOnly: () => set((state) => ({ showUnreadOnly: !state.showUnreadOnly })),
  resetUnreadOnly: () => set({ showUnreadOnly: false }),
}));
