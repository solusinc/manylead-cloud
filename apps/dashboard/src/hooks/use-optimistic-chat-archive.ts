import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/lib/trpc/react";
import { useChatCacheUpdater } from "./use-chat-cache-updater";

interface ToggleArchiveInput {
  id: string;
  createdAt: Date;
  isArchived: boolean;
}

/**
 * Optimistic Archive/Unarchive Hook
 *
 * Pattern: Remove from list immediately, API confirms in background
 * Benefits:
 * - Chat disappears instantly (< 10ms vs 300-600ms)
 * - No loading states needed
 * - Auto-reverts on error
 *
 * Similar to: Gmail's archive, Slack's archive channels
 */
export function useOptimisticChatArchive() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { updateChatInCache, removeChatFromCache, addChatToCache, invalidateChatsWithoutRefetch } = useChatCacheUpdater();

  return useMutation(
    trpc.chats.toggleArchive.mutationOptions({
      onMutate: async (input: ToggleArchiveInput) => {
        // 1. Cancel outgoing queries
        await queryClient.cancelQueries({
          queryKey: [["chats", "list"]],
        });

        // 2. Snapshot previous value for rollback
        // Need to get full chat item from cache to restore on error
        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["chats", "list"]],
          exact: false,
        });

        let previousChatItem = null;
        for (const query of queries) {
          const queryState = query.state.data as {
            items: { chat: { id: string; isArchived: boolean; [key: string]: unknown } }[];
          } | undefined;

          if (queryState?.items) {
            const chatItem = queryState.items.find((item) => item.chat.id === input.id);
            if (chatItem) {
              previousChatItem = chatItem;
              break;
            }
          }
        }

        // 3. Update cache optimistically
        if (input.isArchived) {
          // Archiving: remove from active list
          removeChatFromCache(input.id);
        } else {
          // Unarchiving: update isArchived flag (will refetch to add back)
          updateChatInCache(input.id, {
            isArchived: input.isArchived,
          });
        }

        // Force re-render WITHOUT refetch
        invalidateChatsWithoutRefetch();

        // Invalidate archived count (will refetch in background)
        void queryClient.invalidateQueries({
          queryKey: [["chats", "getArchivedCount"]],
        });

        // Return context for rollback
        return { previousChatItem, chatId: input.id, isArchived: input.isArchived };
      },
      onError: (error, _input, context) => {
        // Rollback on error
        if (context) {
          if (context.isArchived && context.previousChatItem) {
            // Was archiving - restore chat to list
            addChatToCache(context.previousChatItem);
          } else {
            // Was unarchiving - update flag back
            updateChatInCache(context.chatId, {
              isArchived: !context.isArchived,
            });
          }

          invalidateChatsWithoutRefetch();

          // Rollback archived count
          void queryClient.invalidateQueries({
            queryKey: [["chats", "getArchivedCount"]],
          });
        }

        toast.error(error.message || "Erro ao arquivar conversa");
      },
      onSuccess: () => {
        // Success! Refetch to ensure consistency
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
          refetchType: "active",
        });

        void queryClient.invalidateQueries({
          queryKey: [["chats", "getArchivedCount"]],
        });
      },
    })
  );
}
