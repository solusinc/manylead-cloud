import { create } from "zustand";

interface ChatFiltersState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useChatFiltersStore = create<ChatFiltersState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
