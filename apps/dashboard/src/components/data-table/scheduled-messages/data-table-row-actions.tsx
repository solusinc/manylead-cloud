"use client";

import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import { Edit } from "lucide-react";
import { useState } from "react";
import { ScheduledMessageSheet } from "~/components/schedules/scheduled-message-sheet";

interface ScheduledMessageRow {
  scheduledMessage: {
    id: string;
    contentType: string;
    content: string;
    status: string;
    scheduledAt: Date;
  };
  createdByAgent: {
    id: string;
  } | null;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  chat: {
    id: string;
  } | null;
  contact: {
    id: string;
    name: string | null;
  } | null;
}

interface DataTableRowActionsProps {
  row: Row<ScheduledMessageRow>;
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const cancelMutation = useMutation(
    trpc.scheduledMessages.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.scheduledMessages.listByOrganization.queryKey(),
        });
      },
    }),
  );

  // Apenas permitir editar/deletar se estiver pendente
  const isPending = row.original.scheduledMessage.status === "pending";

  if (!isPending) {
    return null;
  }

  const actions = [
    {
      id: "edit",
      label: "Editar",
      icon: Edit,
      variant: "default" as const,
      onClick: () => {
        setEditSheetOpen(true);
      },
    },
  ];

  return (
    <>
      <QuickActions
        actions={actions}
        deleteAction={{
          title: "este agendamento",
          confirmationValue: "cancelar",
          submitAction: async () => {
            await cancelMutation.mutateAsync({
              id: row.original.scheduledMessage.id,
            });
          },
        }}
      />

      <ScheduledMessageSheet
        messages={[row.original]}
        date={new Date(row.original.scheduledMessage.scheduledAt)}
        contentType={row.original.scheduledMessage.contentType as "message" | "comment"}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onDelete={async (messageId: string) => {
          await cancelMutation.mutateAsync({ id: messageId });
        }}
        onUpdate={() => {
          void queryClient.invalidateQueries({
            queryKey: trpc.scheduledMessages.listByOrganization.queryKey(),
          });
        }}
      />
    </>
  );
}
