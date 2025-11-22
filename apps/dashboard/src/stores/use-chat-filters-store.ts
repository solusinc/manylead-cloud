import { create } from "zustand";

export type StatusFilter = "all" | "open" | "closed" | "pending";

interface HeaderFilters {
  status: StatusFilter;
  // TODO: Adicionar outros filtros futuros
  // period?: { start: Date; end: Date };
  // userIds?: string[];
  // departmentIds?: string[];
}

interface ChatFiltersState {
  // Sheet state
  isOpen: boolean;

  // Quick filters (header)
  showUnreadOnly: boolean;

  // Header filters (detalhados do sheet)
  headerFilters: HeaderFilters;

  // Actions
  open: () => void;
  close: () => void;
  toggleUnreadOnly: () => void;
  resetUnreadOnly: () => void;
  setHeaderFilter: <K extends keyof HeaderFilters>(key: K, value: HeaderFilters[K]) => void;
  clearHeaderFilters: () => void;
  getActiveFilterCount: () => number;
}

const defaultHeaderFilters: HeaderFilters = {
  status: "all",
};

export const useChatFiltersStore = create<ChatFiltersState>((set, get) => ({
  isOpen: false,
  showUnreadOnly: false,
  headerFilters: defaultHeaderFilters,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleUnreadOnly: () => set((state) => ({ showUnreadOnly: !state.showUnreadOnly })),
  resetUnreadOnly: () => set({ showUnreadOnly: false }),

  setHeaderFilter: (key, value) =>
    set((state) => ({
      headerFilters: { ...state.headerFilters, [key]: value }
    })),

  clearHeaderFilters: () => set({ headerFilters: defaultHeaderFilters }),

  getActiveFilterCount: () => {
    const { headerFilters } = get();
    let count = 0;

    // Contar apenas filtros que não são "all" ou valores default
    if (headerFilters.status !== "all") count++;
    // TODO: Adicionar contagem de outros filtros quando implementados

    return count;
  },
}));
