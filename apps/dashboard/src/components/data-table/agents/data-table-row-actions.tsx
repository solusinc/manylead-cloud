"use client";

import { useTRPC } from "~/lib/trpc/react";
import { useSession } from "~/lib/auth/client";
import type { Agent } from "@manylead/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Edit, Copy } from "lucide-react";
import { toast } from "sonner";
import { QuickActions } from "~/components/dropdowns/quick-actions";
import { usePermissions } from "~/lib/permissions";

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const { can } = usePermissions();

  const deleteAgentMutation = useMutation(
    trpc.agents.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });
      },
    }),
  );

  // Não mostrar ações se não tiver permissão
  if (!can("manage", "Agent")) {
    return null;
  }

  // Não mostrar ações para o próprio usuário se ele for owner
  const isCurrentUserOwner =
    session && row.original.userId === session.user.id && row.original.role === "owner";

  if (isCurrentUserOwner) {
    return null;
  }

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        router.push(`/settings/agents/${row.original.id}/edit`);
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
        title: row.original.user?.name ?? "este membro",
        confirmationValue: "deletar membro",
        submitAction: async () => {
          await deleteAgentMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
