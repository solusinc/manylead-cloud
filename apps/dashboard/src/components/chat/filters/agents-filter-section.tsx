"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";

import { useTRPC } from "~/lib/trpc/react";

interface AgentsFilterSectionProps {
  selectedAgentIds: string[];
  onToggleAgent: (agentId: string) => void;
}

export function AgentsFilterSection({
  selectedAgentIds,
  onToggleAgent,
}: AgentsFilterSectionProps) {
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
