import { create } from "zustand";

type ChatView = "main" | "archived";

interface ChatViewState {
  view: ChatView;
  setView: (view: ChatView) => void;
  toggleView: () => void;
}

export const useChatViewStore = create<ChatViewState>((set) => ({
  view: "main",
  setView: (view) => set({ view }),
  toggleView: () =>
    set((state) => ({
      view: state.view === "main" ? "archived" : "main",
    })),
}));
