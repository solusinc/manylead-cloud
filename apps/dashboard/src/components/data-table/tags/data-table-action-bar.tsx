"use client";

import type { Tag } from "@manylead/db";
import type { Table } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { Separator } from "@manylead/ui/separator";
import { useTRPC } from "~/lib/trpc/react";
import { DataTableActionBar } from "~/components/ui/data-table/data-table-action-bar";

interface TagDataTableActionBarProps {
  table: Table<Tag>;
}

export function TagDataTableActionBar({ table }: TagDataTableActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const rows = table.getFilteredSelectedRowModel().rows;

  const deleteTagsMutation = useMutation(
    trpc.tags.deleteTags.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.list.queryKey(),
        });
        table.toggleAllRowsSelected(false);
      },
    }),
  );

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <div className="flex h-7 items-center rounded-md border bg-background pl-2.5 pr-1">
        <span className="whitespace-nowrap text-xs">
          {rows.length} selecionados
        </span>
        <Separator orientation="vertical" className="ml-2 mr-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 hover:border"
              onClick={() => table.toggleAllRowsSelected(false)}
            >
              <X className="size-3.5 shrink-0" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center border bg-accent px-2 py-1 font-semibold text-foreground dark:bg-zinc-900">
            <p className="mr-2">Limpar seleção</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="size-7 border"
            disabled={deleteTagsMutation.isPending}
            onClick={() => {
              toast.promise(
                deleteTagsMutation.mutateAsync({
                  ids: rows.map((row) => row.original.id),
                }),
                {
                  loading: "Excluindo...",
                  success: "Etiquetas excluídas",
                  error: "Falha ao excluir etiquetas",
                },
              );
            }}
          >
            <Trash2 className="size-4 shrink-0" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center border bg-accent px-2 py-1 font-semibold text-foreground dark:bg-zinc-900">
          <p className="mr-2">Excluir etiquetas</p>
        </TooltipContent>
      </Tooltip>
    </DataTableActionBar>
  );
}
