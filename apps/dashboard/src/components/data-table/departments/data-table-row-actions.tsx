"use client";

import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import type { Department } from "@manylead/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "~/lib/permissions";

interface DataTableRowActionsProps {
  row: Row<Department>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();

  const deleteDepartmentMutation = useMutation(
    trpc.departments.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
      },
    }),
  );

  // Não mostrar ações se não tiver permissão
  if (!can("manage", "Department")) {
    return null;
  }

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        router.push(`/settings/departments/${row.original.id}/edit`);
      },
    },
    {
      id: "copy-id",
      label: "Copiar ID",
      icon: Copy,
      variant: "default" as const,
      onClick: () => {
        void navigator.clipboard.writeText(row.original.id);
        toast.success("ID copiado");
      },
    },
  ];

  return (
    <QuickActions
      actions={actions}
      deleteAction={
        row.original.isDefault
          ? undefined
          : {
              title: row.original.name,
              confirmationValue: "deletar departamento",
              submitAction: async () => {
                await deleteDepartmentMutation.mutateAsync({
                  id: row.original.id,
                });
              },
            }
      }
    />
  );
}
