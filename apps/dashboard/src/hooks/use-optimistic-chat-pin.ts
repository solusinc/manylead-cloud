import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/lib/trpc/react";
import { useChatCacheUpdater } from "./use-chat-cache-updater";

interface TogglePinInput {
  id: string;
  createdAt: Date;
  isPinned: boolean;
}

/**
 * Optimistic Pin/Unpin Hook
 *
 * Pattern: Update cache immediately, API confirms in background
 * Benefits:
 * - UI responds instantly (< 10ms vs 300-600ms)
 * - No loading states needed
 * - Auto-reverts on error
 *
 * Similar to: Slack's pin messages, Linear's pin issues
 */
export function useOptimisticChatPin() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { updateChatInCache, invalidateChatsWithoutRefetch } = useChatCacheUpdater();

  return useMutation(
    trpc.chats.togglePin.mutationOptions({
      onMutate: async (input: TogglePinInput) => {
        // 1. Cancel outgoing queries to avoid overwriting optimistic update
        await queryClient.cancelQueries({
          queryKey: [["chats", "list"]],
        });

        // 2. Snapshot previous value for rollback
        const previousValue = {
          isPinned: !input.isPinned,
        };

        // 3. Update cache optimistically (INSTANT UI feedback)
        updateChatInCache(input.id, {
          isPinned: input.isPinned,
        });

        // Force re-render WITHOUT refetch
        invalidateChatsWithoutRefetch();

        // Return context for rollback
        return { previousValue, chatId: input.id };
      },
      onError: (error, _input, context) => {
        // Rollback on error
        if (context) {
          updateChatInCache(context.chatId, context.previousValue);
          invalidateChatsWithoutRefetch();
        }

        toast.error(error.message || "Erro ao fixar conversa");
      },
      onSuccess: () => {
        // Success! No need to refetch - optimistic update already applied
      },
    })
  );
}
