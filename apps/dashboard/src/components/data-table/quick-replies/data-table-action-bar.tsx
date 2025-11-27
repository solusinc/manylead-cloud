"use client";

import type { QuickReply } from "@manylead/db";
import type { Table } from "@tanstack/react-table";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@manylead/ui/alert-dialog";
import { Input } from "@manylead/ui/input";
import { Separator } from "@manylead/ui/separator";

import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "~/components/ui/data-table/data-table-action-bar";
import { useTRPC } from "~/lib/trpc/react";
import { usePermissions } from "~/lib/permissions";

interface QuickReplyDataTableActionBarProps {
  table: Table<QuickReply>;
}

export function QuickReplyDataTableActionBar({
  table,
}: QuickReplyDataTableActionBarProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState("");
  const rows = table.getFilteredSelectedRowModel().rows;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const deleteQuickRepliesMutation = useMutation(
    trpc.quickReplies.deleteMany.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.quickReplies.listAdmin.queryKey(),
        });
        table.toggleAllRowsSelected(false);
      },
    }),
  );

  const confirmationValue = React.useMemo(
    () => `deletar resposta${rows.length === 1 ? "" : "s"}`,
    [rows.length],
  );

  // Não mostrar action bar se não tiver permissão
  if (!can("manage", "Organization")) {
    return null;
  }

  const handleDelete = () => {
    try {
      startTransition(async () => {
        const promise = deleteQuickRepliesMutation.mutateAsync({
          ids: rows.map((row) => row.original.id),
        });
        toast.promise(promise, {
          loading: "Deletando...",
          success: "Deletado",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Falha ao deletar";
          },
        });
        await promise;
        setOpen(false);
      });
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <DataTableActionBarSelection table={table} />
      <Separator
        orientation="vertical"
        className="hidden data-[orientation=vertical]:h-5 sm:block"
      />
      <div className="flex items-center gap-1.5">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <DataTableActionBarAction
              size="icon"
              tooltip="Deletar respostas rápidas"
              isPending={isPending || deleteQuickRepliesMutation.isPending}
            >
              <Trash2 />
            </DataTableActionBarAction>
          </AlertDialogTrigger>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.body.style.pointerEvents = "";
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                Deletar {rows.length} resposta{rows.length > 1 ? "s" : ""} rápida{rows.length > 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso removerá permanentemente a
                {rows.length > 1 ? "s" : ""} resposta
                {rows.length > 1 ? "s" : ""} rápida
                {rows.length > 1 ? "s" : ""} selecionada
                {rows.length > 1 ? "s" : ""} do banco de dados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <form id="form-alert-dialog" className="space-y-0.5">
              <p className="text-muted-foreground text-xs">
                Por favor, escreva &apos;
                <span className="font-semibold">{confirmationValue}</span>
                &apos; para confirmar
              </p>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </form>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white shadow-xs"
                disabled={value !== confirmationValue || isPending}
                form="form-alert-dialog"
                type="submit"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                {isPending ? "Deletando..." : "Deletar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DataTableActionBar>
  );
}
