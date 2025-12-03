"use client";

import type { Table } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "~/components/ui/data-table/data-table-action-bar";
import { Separator } from "@manylead/ui/separator";

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

interface ScheduledMessagesDataTableActionBarProps {
  table: Table<ScheduledMessageRow>;
}

export function ScheduledMessagesDataTableActionBar({
  table,
}: ScheduledMessagesDataTableActionBarProps) {
  const rows = table.getFilteredSelectedRowModel().rows;

  const handleCancel = () => {
    if (!confirm(`Tem certeza que deseja cancelar ${rows.length} agendamento${rows.length > 1 ? "s" : ""}?`)) {
      return;
    }

    // TODO: Implement cancel mutation
    console.log("Cancel messages:", rows.map((r) => r.original.scheduledMessage.id));
    table.toggleAllRowsSelected(false);
  };

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <DataTableActionBarSelection table={table} />
      <Separator
        orientation="vertical"
        className="hidden data-[orientation=vertical]:h-5 sm:block"
      />
      <div className="flex items-center gap-1.5">
        <DataTableActionBarAction
          size="icon"
          tooltip="Cancelar agendamentos"
          onClick={handleCancel}
        >
          <Trash2 />
        </DataTableActionBarAction>
      </div>
    </DataTableActionBar>
  );
}
