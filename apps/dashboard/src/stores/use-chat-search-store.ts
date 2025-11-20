import { create } from "zustand";

type SearchMode = "chats" | "contacts";

interface ChatSearchState {
  searchTerm: string;
  searchMode: SearchMode;
  setSearchTerm: (term: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  clearSearch: () => void;
}

export const useChatSearchStore = create<ChatSearchState>((set) => ({
  searchTerm: "",
  searchMode: "chats",
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSearchMode: (mode) => set({ searchMode: mode }),
  clearSearch: () => set({ searchTerm: "", searchMode: "chats" }),
}));

// Helper para verificar se busca está ativa
export const useIsSearchActive = () => {
  const searchTerm = useChatSearchStore((state) => state.searchTerm);
  return searchTerm.trim().length > 0;
};
