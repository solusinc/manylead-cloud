"use client";

import type { Table } from "@tanstack/react-table";
import { Separator } from "@manylead/ui/separator";

import type { Agent } from "@manylead/db";
import {
  DataTableActionBar,
  DataTableActionBarSelection,
} from "~/components/ui/data-table/data-table-action-bar";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

interface AgentDataTableActionBarProps {
  table: Table<AgentWithUser>;
}

export function AgentDataTableActionBar({
  table,
}: AgentDataTableActionBarProps) {
  const rows = table.getFilteredSelectedRowModel().rows;

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <DataTableActionBarSelection table={table} />
      <Separator
        orientation="vertical"
        className="hidden data-[orientation=vertical]:h-5 sm:block"
      />
      <div className="flex items-center gap-1.5">
        {/* TODO: Implementar ações em lote quando necessário */}
      </div>
    </DataTableActionBar>
  );
}
