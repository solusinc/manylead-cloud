"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";
import { Label } from "@manylead/ui/label";
import { RadioGroup, RadioGroupItem } from "@manylead/ui/radio-group";

import { useTRPC } from "~/lib/trpc/react";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";

import type { StatusFilter, MessageSourceFilter } from "~/stores/use-chat-filters-store";

export function ChatFiltersSheet() {
  const { isOpen, close, headerFilters, setHeaderFilter, toggleTagFilter, toggleAgentFilter, toggleDepartmentFilter, toggleMessageSourceFilter, clearHeaderFilters } = useChatFiltersStore();

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

          {/* TODO: Período */}
          <FilterAccordion title="Período" disabled />

          {/* Usuários (Agents) */}
          <AgentsFilterSection
            selectedAgentIds={headerFilters.agentIds}
            onToggleAgent={toggleAgentFilter}
          />

          {/* TODO: Finalizações */}
          <FilterAccordion title="Finalizações" disabled />

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

/**
 * Accordion genérico para filtros
 */
function FilterAccordion({
  title,
  defaultOpen = false,
  disabled = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between py-4 text-left",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className="text-base font-semibold">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && !disabled && (
        <div className="pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Seção de filtro por Etiquetas com busca
 */
function TagsFilterSection({
  selectedTagIds,
  onToggleTag,
}: {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const trpc = useTRPC();

  // Buscar todas as tags
  const { data: tags = [], isLoading } = useQuery(
    trpc.tags.list.queryOptions()
  );

  // Filtrar tags pelo termo de busca
  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return tags;
    const term = searchTerm.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [tags, searchTerm]);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Etiquetas</span>
          {selectedTagIds.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedTagIds.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-3">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="buscar etiqueta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de tags */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : filteredTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada"}
              </p>
            ) : (
              filteredTags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
                >
                  <Checkbox
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => onToggleTag(tag.id)}
                  />
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de filtro por Usuários (Agents) com busca
 */
function AgentsFilterSection({
  selectedAgentIds,
  onToggleAgent,
}: {
  selectedAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const trpc = useTRPC();

  // Buscar todos os agents
  const { data: agents = [], isLoading } = useQuery(
    trpc.agents.list.queryOptions()
  );

  // Filtrar agents pelo termo de busca
  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) return agents;
    const term = searchTerm.toLowerCase();
    return agents.filter((agent) => {
      const name = agent.user?.name ?? "";
      const email = agent.user?.email ?? "";
      return name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
    });
  }, [agents, searchTerm]);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Usuários</span>
          {selectedAgentIds.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedAgentIds.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-3">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="buscar usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de agents */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : filteredAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário cadastrado"}
              </p>
            ) : (
              filteredAgents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
                >
                  <Checkbox
                    checked={selectedAgentIds.includes(agent.id)}
                    onCheckedChange={() => onToggleAgent(agent.id)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm">{agent.user?.name ?? "Sem nome"}</span>
                    {agent.user?.email && (
                      <span className="text-xs text-muted-foreground">{agent.user.email}</span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de filtro por Departamentos com busca
 */
function DepartmentsFilterSection({
  selectedDepartmentIds,
  onToggleDepartment,
}: {
  selectedDepartmentIds: string[];
  onToggleDepartment: (departmentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const trpc = useTRPC();

  // Buscar todos os departamentos
  const { data: departments = [], isLoading } = useQuery(
    trpc.departments.list.queryOptions()
  );

  // Filtrar departamentos pelo termo de busca
  const filteredDepartments = useMemo(() => {
    if (!searchTerm.trim()) return departments;
    const term = searchTerm.toLowerCase();
    return departments.filter((dept) => dept.name.toLowerCase().includes(term));
  }, [departments, searchTerm]);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Departamentos</span>
          {selectedDepartmentIds.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedDepartmentIds.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-3">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="buscar departamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de departamentos */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : filteredDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Nenhum departamento encontrado" : "Nenhum departamento cadastrado"}
              </p>
            ) : (
              filteredDepartments.map((dept) => (
                <label
                  key={dept.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
                >
                  <Checkbox
                    checked={selectedDepartmentIds.includes(dept.id)}
                    onCheckedChange={() => onToggleDepartment(dept.id)}
                  />
                  <span className="text-sm">{dept.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Seção de filtro por Provedores (Manylead/WhatsApp)
 */
function ProvidersFilterSection({
  selectedSources,
  onToggleSource,
}: {
  selectedSources: MessageSourceFilter[];
  onToggleSource: (source: MessageSourceFilter) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const providers: { id: MessageSourceFilter; label: string; icon: React.ReactNode }[] = [
    {
      id: "internal",
      label: "Manylead",
      icon: (
        <>
          <Image
            src="/assets/manylead-icon-light.png"
            alt="ManyLead"
            width={20}
            height={20}
            className="dark:hidden"
          />
          <Image
            src="/assets/manylead-icon-dark.png"
            alt="ManyLead"
            width={20}
            height={20}
            className="hidden dark:block"
          />
        </>
      ),
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <FaWhatsapp className="text-foreground h-5 w-5" />,
    },
  ];

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Provedores</span>
          {selectedSources.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedSources.length}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-2">
          {providers.map((provider) => (
            <label
              key={provider.id}
              className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
            >
              <Checkbox
                checked={selectedSources.includes(provider.id)}
                onCheckedChange={() => onToggleSource(provider.id)}
              />
              <div className="flex items-center gap-2">
                <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {provider.icon}
                </div>
                <span className="text-sm">{provider.label}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
