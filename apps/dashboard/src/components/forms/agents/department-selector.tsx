"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  Badge,
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@manylead/ui";

import { useTRPC } from "~/lib/trpc/react";

interface Department {
  id: string;
  name: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DepartmentSelectorProps {
  value: string[];
  onChange: (departmentIds: string[]) => void;
  disabled?: boolean;
}

export function DepartmentSelector({
  value,
  onChange,
  disabled,
}: DepartmentSelectorProps) {
  const trpc = useTRPC();
  const { data: departments = [], isLoading } = useQuery(
    trpc.departments.list.queryOptions(),
  );

  // Pegar informações dos departamentos selecionados
  const selectedDepartments = departments.filter((dept: Department) =>
    value.includes(dept.id),
  );

  const handleToggle = (departmentId: string) => {
    if (value.includes(departmentId)) {
      onChange(value.filter((id) => id !== departmentId));
    } else {
      onChange([...value, departmentId]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-auto min-h-9 w-full justify-between",
            !selectedDepartments.length && "text-muted-foreground",
          )}
          disabled={disabled ?? isLoading}
        >
          <div className="group/badges flex flex-wrap gap-1">
            {selectedDepartments.length ? (
              selectedDepartments.map((dept: Department) => (
                <Badge
                  key={dept.id}
                  variant="secondary"
                  className="relative flex items-center gap-1.5 rounded-full"
                >
                  {dept.name}
                </Badge>
              ))
            ) : (
              <span>Selecionar departamento</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar departamentos..." />
          <CommandList className="w-full">
            <CommandEmpty className="px-4 py-6 text-center text-sm">
              {isLoading ? "Carregando..." : "Nenhum departamento encontrado."}
            </CommandEmpty>
            <CommandGroup>
              {departments.map((dept: Department) => (
                <CommandItem
                  value={dept.name}
                  key={dept.id}
                  onSelect={() => handleToggle(dept.id)}
                >
                  {dept.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value.includes(dept.id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
