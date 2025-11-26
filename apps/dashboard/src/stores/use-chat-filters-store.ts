import { create } from "zustand";

export type StatusFilter = "all" | "open" | "closed" | "pending";
export type MessageSourceFilter = "whatsapp" | "internal";

export interface PeriodFilter {
  from: Date | undefined;
  to: Date | undefined;
}

interface HeaderFilters {
  status: StatusFilter;
  tagIds: string[];
  agentIds: string[];
  departmentIds: string[];
  messageSources: MessageSourceFilter[];
  period: PeriodFilter;
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
  toggleTagFilter: (tagId: string) => void;
  toggleAgentFilter: (agentId: string) => void;
  toggleDepartmentFilter: (departmentId: string) => void;
  toggleMessageSourceFilter: (source: MessageSourceFilter) => void;
  setPeriodFilter: (period: PeriodFilter) => void;
  clearHeaderFilters: () => void;
  getActiveFilterCount: () => number;
}

const defaultHeaderFilters: HeaderFilters = {
  status: "all",
  tagIds: [],
  agentIds: [],
  departmentIds: [],
  messageSources: [],
  period: { from: undefined, to: undefined },
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

  toggleTagFilter: (tagId) =>
    set((state) => {
      const currentTags = state.headerFilters.tagIds;
      const newTags = currentTags.includes(tagId)
        ? currentTags.filter((id) => id !== tagId)
        : [...currentTags, tagId];
      return {
        headerFilters: { ...state.headerFilters, tagIds: newTags }
      };
    }),

  toggleAgentFilter: (agentId) =>
    set((state) => {
      const currentAgents = state.headerFilters.agentIds;
      const newAgents = currentAgents.includes(agentId)
        ? currentAgents.filter((id) => id !== agentId)
        : [...currentAgents, agentId];
      return {
        headerFilters: { ...state.headerFilters, agentIds: newAgents }
      };
    }),

  toggleDepartmentFilter: (departmentId) =>
    set((state) => {
      const currentDepartments = state.headerFilters.departmentIds;
      const newDepartments = currentDepartments.includes(departmentId)
        ? currentDepartments.filter((id) => id !== departmentId)
        : [...currentDepartments, departmentId];
      return {
        headerFilters: { ...state.headerFilters, departmentIds: newDepartments }
      };
    }),

  toggleMessageSourceFilter: (source) =>
    set((state) => {
      const currentSources = state.headerFilters.messageSources;
      const newSources = currentSources.includes(source)
        ? currentSources.filter((s) => s !== source)
        : [...currentSources, source];
      return {
        headerFilters: { ...state.headerFilters, messageSources: newSources }
      };
    }),

  setPeriodFilter: (period) =>
    set((state) => ({
      headerFilters: { ...state.headerFilters, period }
    })),

  clearHeaderFilters: () => set({ headerFilters: defaultHeaderFilters }),

  getActiveFilterCount: () => {
    const { headerFilters } = get();
    let count = 0;

    // Contar apenas filtros que não são "all" ou valores default
    // Cada tipo de filtro conta como 1, independente de quantos valores
    if (headerFilters.status !== "all") count++;
    if (headerFilters.tagIds.length > 0) count++;
    if (headerFilters.agentIds.length > 0) count++;
    if (headerFilters.departmentIds.length > 0) count++;
    if (headerFilters.messageSources.length > 0) count++;
    if (headerFilters.period.from || headerFilters.period.to) count++;

    return count;
  },
}));
