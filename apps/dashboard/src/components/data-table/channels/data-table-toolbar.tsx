"use client";

import { DataTableFacetedFilter } from "~/components/ui/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "~/components/ui/data-table/data-table-view-options";
import type { Table } from "@tanstack/react-table";
import type { Channel } from "@manylead/db";
import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import { X } from "lucide-react";

type ChannelRow = Omit<Channel, "authState" | "sessionData">;

interface DataTableToolbarProps {
  table: Table<ChannelRow>;
}

export function ChannelDataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filtrar canais..."
          value={(table.getColumn("displayName")?.getFilterValue() ?? "") as string}
          onChange={(event) =>
            table.getColumn("displayName")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={[
              { label: "Pendente", value: "pending" },
              { label: "Conectado", value: "connected" },
              { label: "Desconectado", value: "disconnected" },
              { label: "Erro", value: "error" },
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
