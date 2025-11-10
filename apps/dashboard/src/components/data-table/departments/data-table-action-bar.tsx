"use client";

import type { Table } from "@tanstack/react-table";
import * as React from "react";
import { SelectTrigger } from "@radix-ui/react-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Department } from "@manylead/db";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@manylead/ui/select";
import { Separator } from "@manylead/ui/separator";

import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from "~/components/ui/data-table/data-table-action-bar";
import { useTRPC } from "~/lib/trpc/react";

const ACTIVE = [
  { label: "ativo", value: true },
  { label: "inativo", value: false },
];

interface DepartmentDataTableActionBarProps {
  table: Table<Department>;
}

export function DepartmentDataTableActionBar({
  table,
}: DepartmentDataTableActionBarProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState("");
  const rows = table.getFilteredSelectedRowModel().rows;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteDepartmentsMutation = useMutation(
    trpc.departments.deleteDepartments.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
        // Clear selection once deletion succeeds
        table.toggleAllRowsSelected(false);
      },
    }),
  );

  const updateDepartmentsMutation = useMutation(
    trpc.departments.updateDepartments.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
      },
    }),
  );

  const confirmationValue = React.useMemo(
    () => `deletar departamento${rows.length === 1 ? "" : "s"}`,
    [rows.length],
  );

  const handleDelete = () => {
    try {
      startTransition(async () => {
        const promise = deleteDepartmentsMutation.mutateAsync({
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
        <Select
          onValueChange={(v) => {
            void toast.promise(
              updateDepartmentsMutation.mutateAsync({
                ids: rows.map((row) => row.original.id),
                isActive: v === "ativo",
              }),
              {
                loading: "Atualizando...",
                success: "Atualizado",
                error: (error) => {
                  if (isTRPCClientError(error)) {
                    return error.message;
                  }
                  return "Falha ao atualizar";
                },
              },
            );
          }}
        >
          <SelectTrigger asChild>
            <DataTableActionBarAction size="icon" tooltip="Atualizar status">
              <CheckCircle2 />
            </DataTableActionBarAction>
          </SelectTrigger>
          <SelectContent align="center">
            <SelectGroup>
              {ACTIVE.map((status) => (
                <SelectItem
                  key={status.label}
                  value={status.label}
                  className="capitalize"
                >
                  {status.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <DataTableActionBarAction
              size="icon"
              tooltip="Deletar departamentos"
              isPending={isPending || deleteDepartmentsMutation.isPending}
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
                Deletar {rows.length} departamento{rows.length > 1 ? "s" : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso removerá permanentemente o
                {rows.length > 1 ? "s" : ""} departamento
                {rows.length > 1 ? "s" : ""} selecionado
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
