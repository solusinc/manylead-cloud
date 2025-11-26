"use client";

import type { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import type { QuickReply } from "@manylead/db";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";

import { DataTableViewOptions } from "~/components/ui/data-table/data-table-view-options";
import { DataTableFacetedFilter } from "~/components/ui/data-table/data-table-faceted-filter";

interface DataTableToolbarProps {
  table: Table<QuickReply>;
}

const visibilityOptions = [
  { value: "organization", label: "Para todos" },
  { value: "private", label: "Privada" },
];

export function QuickReplyDataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filtrar por título..."
          value={(table.getColumn("title")?.getFilterValue() ?? "") as string}
          onChange={(event) =>
            table.getColumn("title")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("visibility") && (
          <DataTableFacetedFilter
            column={table.getColumn("visibility")}
            title="Visibilidade"
            options={visibilityOptions}
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
