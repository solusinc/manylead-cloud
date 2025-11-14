"use client";

import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import type { Channel } from "@manylead/db";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Edit, Copy, Unplug } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "~/lib/permissions";

type ChannelRow = Omit<Channel, "authState" | "sessionData">;

interface DataTableRowActionsProps {
  row: Row<ChannelRow>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { can } = usePermissions();

  const disconnectMutation = useMutation(
    trpc.channels.disconnect.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.channels.list.queryKey(),
        });
        toast.success("Canal desconectado");
      },
    }),
  );

  const deleteChannelMutation = useMutation(
    trpc.channels.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.channels.list.queryKey(),
        });
        toast.success("Canal deletado");
      },
    }),
  );

  // Não mostrar ações se não tiver permissão
  if (!can("manage", "Channel")) {
    return null;
  }

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        router.push(`/settings/channels/${row.original.id}/edit`);
      },
    },
    {
      id: "disconnect",
      label: "Desconectar",
      icon: Unplug,
      variant: "default" as const,
      onClick: async () => {
        await disconnectMutation.mutateAsync({ id: row.original.id });
      },
      disabled: row.original.status === "disconnected",
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
        title: row.original.displayName || "este canal",
        confirmationValue: "deletar canal",
        submitAction: async () => {
          await deleteChannelMutation.mutateAsync({
            id: row.original.id,
          });
        },
      }}
    />
  );
}
