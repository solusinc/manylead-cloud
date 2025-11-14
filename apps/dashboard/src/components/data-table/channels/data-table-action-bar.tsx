"use client";

import type { Table } from "@tanstack/react-table";
import * as React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Channel } from "@manylead/db";

type ChannelRow = Omit<Channel, "authState" | "sessionData">;
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

interface ChannelDataTableActionBarProps {
  table: Table<ChannelRow>;
}

export function ChannelDataTableActionBar({
  table,
}: ChannelDataTableActionBarProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState("");
  const rows = table.getFilteredSelectedRowModel().rows;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const deleteMutation = useMutation(trpc.channels.delete.mutationOptions());

  const confirmationValue = React.useMemo(
    () => `deletar cana${rows.length === 1 ? "l" : "is"}`,
    [rows.length],
  );

  // Não mostrar action bar se não tiver permissão
  if (!can("manage", "Channel")) {
    return null;
  }

  const handleDelete = () => {
    try {
      startTransition(async () => {
        // Deletar canais um por um (não temos batch delete ainda)
        const promises = rows.map((row) =>
          deleteMutation.mutateAsync({ id: row.original.id })
        );

        const promise = Promise.all(promises).then(() => {
          void queryClient.invalidateQueries({
            queryKey: trpc.channels.list.queryKey(),
          });
          table.toggleAllRowsSelected(false);
        });

        toast.promise(promise, {
          loading: "Deletando...",
          success: `${rows.length} canal${rows.length > 1 ? "is" : ""} deletado${rows.length > 1 ? "s" : ""}`,
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
              tooltip="Deletar canais"
              isPending={isPending}
            >
              <Trash2 />
            </DataTableActionBarAction>
          </AlertDialogTrigger>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              // Work-around: body becomes unclickable after closing the dialog
              event.preventDefault();
              document.body.style.pointerEvents = "";
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                Deletar {rows.length} cana{rows.length > 1 ? "is" : "l"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso removerá permanentemente o
                {rows.length > 1 ? "s" : ""} cana
                {rows.length > 1 ? "is" : "l"} selecionado
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
