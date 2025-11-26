"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Checkbox } from "@manylead/ui/checkbox";
import { Input } from "@manylead/ui/input";

import { useTRPC } from "~/lib/trpc/react";

interface DepartmentsFilterSectionProps {
  selectedDepartmentIds: string[];
  onToggleDepartment: (departmentId: string) => void;
}

export function DepartmentsFilterSection({
  selectedDepartmentIds,
  onToggleDepartment,
}: DepartmentsFilterSectionProps) {
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
