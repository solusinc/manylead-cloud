"use client";

import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import type { Tag } from "@manylead/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "~/lib/permissions";

interface DataTableRowActionsProps {
  row: Row<Tag>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();

  const deleteTagMutation = useMutation(
    trpc.tags.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.list.queryKey(),
        });
      },
    }),
  );

  // Nao mostrar acoes se nao tiver permissao
  if (!can("manage", "Tag")) {
    return null;
  }

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        router.push(`/settings/tags/${row.original.id}/edit`);
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
      deleteAction={{
        title: row.original.name,
        confirmationValue: "deletar etiqueta",
        submitAction: async () => {
          await deleteTagMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
