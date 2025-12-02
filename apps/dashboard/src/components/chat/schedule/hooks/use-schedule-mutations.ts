"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";

/**
 * Hook para mutations de agendamentos
 */
export function useScheduleMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.scheduledMessages.create.mutationOptions({
      onSuccess: () => {
        // Invalidar queries de agendamentos
        void queryClient.invalidateQueries({
          queryKey: [["scheduledMessages"]],
        });
      },
    })
  );

  const updateMutation = useMutation(
    trpc.scheduledMessages.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [["scheduledMessages"]],
        });
      },
    })
  );

  const cancelMutation = useMutation(
    trpc.scheduledMessages.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [["scheduledMessages"]],
        });
      },
    })
  );

  return {
    create: createMutation,
    update: updateMutation,
    cancel: cancelMutation,
  };
}
