"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";

import { useTRPC } from "~/lib/trpc/react";

interface TagsFilterSectionProps {
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
}

export function TagsFilterSection({
  selectedTagIds,
  onToggleTag,
}: TagsFilterSectionProps) {
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
