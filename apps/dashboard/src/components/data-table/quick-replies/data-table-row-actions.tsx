"use client";

import type { Row } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Edit, Copy } from "lucide-react";
import { toast } from "sonner";

import type { QuickReply } from "@manylead/db";

import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";

interface DataTableRowActionsProps {
  row: Row<QuickReply>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteQuickReplyMutation = useMutation(
    trpc.quickReplies.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.quickReplies.listAdmin.queryKey(),
        });
        toast.success("Resposta rápida deletada com sucesso");
      },
      onError: (error) => {
        // Mostrar mensagem de erro do backend
        const errorMessage = error.message || "Erro ao deletar resposta rápida";
        toast.error(errorMessage);
      },
    }),
  );

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        router.push(`/settings/quick-replies/${row.original.id}`);
      },
    },
    {
      id: "copy-shortcut",
      label: "Copiar atalho",
      icon: Copy,
      variant: "default" as const,
      onClick: () => {
        void navigator.clipboard.writeText(row.original.shortcut);
        toast.success("Atalho copiado");
      },
    },
  ];

  return (
    <QuickActions
      actions={actions}
      deleteAction={{
        title: row.original.title,
        confirmationValue: "deletar resposta",
        submitAction: async () => {
          await deleteQuickReplyMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
