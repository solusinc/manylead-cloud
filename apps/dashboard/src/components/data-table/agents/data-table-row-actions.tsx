"use client";

import type { Row } from "@tanstack/react-table";
import { MoreHorizontal, Pencil } from "lucide-react";

import type { Agent } from "@manylead/db";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

interface DataTableRowActionsProps {
  row: Row<AgentWithUser>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted flex h-8 w-8 p-0"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Abrir menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem asChild>
          <a href={`/settings/agents/${row.original.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* TODO: Adicionar ação de deletar quando necessário */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
