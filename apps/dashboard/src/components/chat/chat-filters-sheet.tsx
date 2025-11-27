"use client";

import { Button } from "@manylead/ui/button";
import { Label } from "@manylead/ui/label";
import { RadioGroup, RadioGroupItem } from "@manylead/ui/radio-group";

import type { StatusFilter } from "~/stores/use-chat-filters-store";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";
import {
  AgentsFilterSection,
  DepartmentsFilterSection,
  EndingsFilterSection,
  FilterAccordion,
  PeriodFilterSection,
  ProvidersFilterSection,
  TagsFilterSection,
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
        className="bg-background/80 absolute inset-0 z-40 backdrop-blur-sm"
        onClick={close}
      />

      {/* Sheet */}
      <div className="bg-background absolute inset-0 z-50 flex flex-col">
        {/* Content */}
        <div className="flex-1 space-y-2 overflow-y-auto px-6 pb-24">
          {/* Situação */}
          <FilterAccordion title="Situação" defaultOpen>
            <RadioGroup
              value={headerFilters.status}
              onValueChange={(v) =>
                setHeaderFilter("status", v as StatusFilter)
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="status-all" />
                <Label
                  htmlFor="status-all"
                  className="cursor-pointer font-normal"
                >
                  Todas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="open" id="status-open" />
                <Label
                  htmlFor="status-open"
                  className="cursor-pointer font-normal"
                >
                  Em atendimento
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="closed" id="status-closed" />
                <Label
                  htmlFor="status-closed"
                  className="cursor-pointer font-normal"
                >
                  Finalizadas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="status-pending" />
                <Label
                  htmlFor="status-pending"
                  className="cursor-pointer font-normal"
                >
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
        <div className="bg-background flex h-14 items-center border-t px-4">
          <div className="flex w-full gap-3">
            <Button onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
            <Button
              onClick={handleClearFilters}
              variant="ghost"
              className="text-muted-foreground"
            >
              Remover filtros
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
