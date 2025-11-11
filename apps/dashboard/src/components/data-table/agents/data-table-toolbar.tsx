"use client";

import { DataTableFacetedFilter } from "~/components/ui/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "~/components/ui/data-table/data-table-view-options";
import type { Table } from "@tanstack/react-table";
import type { Agent } from "@manylead/db";
import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import { X } from "lucide-react";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

interface DataTableToolbarProps {
  table: Table<AgentWithUser>;
}

export function AgentDataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filtrar membros..."
          value={(table.getColumn("name")?.getFilterValue() ?? "") as string}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("isActive") && (
          <DataTableFacetedFilter
            column={table.getColumn("isActive")}
            title="Status"
            options={[
              { label: "Ativo", value: "true" },
              { label: "Inativo", value: "false" },
            ]}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Limpar
            <X />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
