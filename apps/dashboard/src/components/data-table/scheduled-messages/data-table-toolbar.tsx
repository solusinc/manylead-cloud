"use client";

import type { Table } from "@tanstack/react-table";
import { Button } from "@manylead/ui/button";
import { Input } from "@manylead/ui/input";
import { X } from "lucide-react";

import { DataTableFacetedFilter } from "~/components/ui/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "~/components/ui/data-table/data-table-view-options";

interface ScheduledMessageRow {
  scheduledMessage: {
    id: string;
    contentType: string;
    content: string;
    status: string;
    scheduledAt: Date;
  };
  createdByAgent: {
    id: string;
  } | null;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  chat: {
    id: string;
  } | null;
  contact: {
    id: string;
    name: string | null;
  } | null;
}

interface DataTableToolbarProps {
  table: Table<ScheduledMessageRow>;
}

export function ScheduledMessagesDataTableToolbar({ table }: DataTableToolbarProps) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filtrar por contato..."
          value={(table.getColumn("contact")?.getFilterValue() ?? "") as string}
          onChange={(event) =>
            table.getColumn("contact")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn("type") && (
          <DataTableFacetedFilter
            column={table.getColumn("type")}
            title="Tipo"
            options={[
              { label: "Mensagem", value: "message" },
              { label: "Nota", value: "comment" },
            ]}
          />
        )}
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={[
              { label: "Pendente", value: "pending" },
              { label: "Processando", value: "processing" },
              { label: "Enviado", value: "sent" },
              { label: "Falhou", value: "failed" },
              { label: "Cancelado", value: "cancelled" },
              { label: "Expirado", value: "expired" },
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
