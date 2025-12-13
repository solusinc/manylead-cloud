import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "~/lib/trpc/react";
import { useChatCacheUpdater } from "./use-chat-cache-updater";

interface AssignChatInput {
  id: string;
  createdAt: Date;
  agentId: string;
}

/**
 * Optimistic Chat Assign Hook
 *
 * Pattern: Update status and assignedTo immediately, API confirms in background
 * Benefits:
 * - "Pegar atendimento" responds instantly (< 10ms vs 300-600ms)
 * - Chat status changes to "open" immediately
 * - Auto-reverts on error
 *
 * Similar to: Linear's assign issue, Notion's assign page
 */
export function useOptimisticChatAssign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { updateChatInCache, invalidateChatsWithoutRefetch, invalidateActiveChats } = useChatCacheUpdater();

  return useMutation(
    trpc.chats.assign.mutationOptions({
      onMutate: async (input: AssignChatInput) => {
        // 1. Cancel outgoing queries
        await queryClient.cancelQueries({
          queryKey: [["chats", "list"]],
        });

        // 2. Snapshot previous value for rollback
        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["chats", "list"]],
          exact: false,
        });

        let previousValues = null;
        for (const query of queries) {
          const queryState = query.state.data as {
            items: { chat: { id: string; status: string; assignedTo: string | null; assignedAgentName?: string | null; unreadCount?: number } }[];
          } | undefined;

          if (queryState?.items) {
            const chatItem = queryState.items.find((item) => item.chat.id === input.id);
            if (chatItem) {
              previousValues = {
                status: chatItem.chat.status,
                assignedTo: chatItem.chat.assignedTo,
                assignedAgentName: chatItem.chat.assignedAgentName,
                unreadCount: chatItem.chat.unreadCount,
              };
              break;
            }
          }
        }

        // 3. Update cache optimistically (INSTANT UI feedback)
        // Note: assignedAgentName will be updated by socket onChatUpdated
        updateChatInCache(input.id, {
          status: "open",
          assignedTo: input.agentId,
          unreadCount: 0, // Mark as read when assigning
        });

        // Force re-render WITHOUT refetch
        invalidateChatsWithoutRefetch();

        // Return context for rollback
        return { previousValues, chatId: input.id };
      },
      onError: (error, _input, context) => {
        // Rollback on error
        if (context?.previousValues) {
          updateChatInCache(context.chatId, context.previousValues);
          invalidateChatsWithoutRefetch();
        }

        toast.error(error.message || "Erro ao atribuir chat");
      },
      onSuccess: () => {
        // Success! Socket will emit onChatUpdated which will trigger mark-read
        // Refetch active queries to ensure consistency
        invalidateActiveChats();
      },
    })
  );
}
