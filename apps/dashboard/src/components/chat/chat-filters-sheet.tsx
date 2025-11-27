"use client";

import { Button } from "@manylead/ui/button";
import { Label } from "@manylead/ui/label";
import { RadioGroup, RadioGroupItem } from "@manylead/ui/radio-group";

import { useChatFiltersStore } from "~/stores/use-chat-filters-store";

import type { StatusFilter } from "~/stores/use-chat-filters-store";
import {
  FilterAccordion,
  PeriodFilterSection,
  AgentsFilterSection,
  DepartmentsFilterSection,
  EndingsFilterSection,
  TagsFilterSection,
  ProvidersFilterSection,
} from "./filters";

export function ChatFiltersSheet() {
  const {
    isOpen,
    close,
    headerFilters,
    setHeaderFilter,
    toggleTagFilter,
    toggleAgentFilter,
    toggleDepartmentFilter,
    toggleEndingFilter,
    toggleMessageSourceFilter,
    setPeriodFilter,
    clearHeaderFilters,
  } = useChatFiltersStore();

  const handleApply = () => {
    close();
  };

  const handleClearFilters = () => {
    clearHeaderFilters();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={close}
      />

      {/* Sheet */}
      <div className="absolute inset-0 z-50 bg-background flex flex-col">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 pb-24">
          {/* Situação */}
          <FilterAccordion title="Situação" defaultOpen>
            <RadioGroup
              value={headerFilters.status}
              onValueChange={(v) => setHeaderFilter("status", v as StatusFilter)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" />
                <Label htmlFor="status-all" className="font-normal cursor-pointer">
                  Todas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="open" id="status-open" />
                <Label htmlFor="status-open" className="font-normal cursor-pointer">
                  Em atendimento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="closed" id="status-closed" />
                <Label htmlFor="status-closed" className="font-normal cursor-pointer">
                  Finalizadas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="status-pending" />
                <Label htmlFor="status-pending" className="font-normal cursor-pointer">
                  Aguardando atendimento
                </Label>
              </div>
            </RadioGroup>
          </FilterAccordion>

          {/* Período */}
          <PeriodFilterSection
            period={headerFilters.period}
            onPeriodChange={setPeriodFilter}
          />

          {/* Usuários (Agents) */}
          <AgentsFilterSection
            selectedAgentIds={headerFilters.agentIds}
            onToggleAgent={toggleAgentFilter}
          />

          {/* Finalizações */}
          <EndingsFilterSection
            selectedEndingIds={headerFilters.endingIds}
            onToggleEnding={toggleEndingFilter}
          />

          {/* Departamentos */}
          <DepartmentsFilterSection
            selectedDepartmentIds={headerFilters.departmentIds}
            onToggleDepartment={toggleDepartmentFilter}
          />

          {/* Etiquetas */}
          <TagsFilterSection
            selectedTagIds={headerFilters.tagIds}
            onToggleTag={toggleTagFilter}
          />

          {/* Provedores */}
          <ProvidersFilterSection
            selectedSources={headerFilters.messageSources}
            onToggleSource={toggleMessageSourceFilter}
          />
        </div>

        {/* Footer com botões */}
        <div className="border-t bg-background h-14 flex items-center px-4">
          <div className="flex gap-3 w-full">
            <Button onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
            <Button onClick={handleClearFilters} variant="ghost" className="text-muted-foreground">
              Remover filtros
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
