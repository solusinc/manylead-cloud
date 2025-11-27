"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";

import { useTRPC } from "~/lib/trpc/react";

interface EndingsFilterSectionProps {
  selectedEndingIds: string[];
  onToggleEnding: (endingId: string) => void;
}

export function EndingsFilterSection({
  selectedEndingIds,
  onToggleEnding,
}: EndingsFilterSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const trpc = useTRPC();

  // Buscar todos os endings
  const { data: endings = [], isLoading } = useQuery(
    trpc.endings.list.queryOptions()
  );

  // Filtrar endings pelo termo de busca
  const filteredEndings = useMemo(() => {
    if (!searchTerm.trim()) return endings;
    const term = searchTerm.toLowerCase();
    return endings.filter((ending) => ending.title.toLowerCase().includes(term));
  }, [endings, searchTerm]);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Finalizações</span>
          {selectedEndingIds.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {selectedEndingIds.length}
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
              placeholder="buscar motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Lista de endings */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : filteredEndings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Nenhum motivo encontrado" : "Nenhum motivo cadastrado"}
              </p>
            ) : (
              filteredEndings.map((ending) => (
                <label
                  key={ending.id}
                  className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 -mx-2"
                >
                  <Checkbox
                    checked={selectedEndingIds.includes(ending.id)}
                    onCheckedChange={() => onToggleEnding(ending.id)}
                  />
                  <span className="text-sm">{ending.title}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
