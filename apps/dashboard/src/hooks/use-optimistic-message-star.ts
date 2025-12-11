import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@manylead/ui/toast";

import { useTRPC } from "~/lib/trpc/react";

interface StarMessageInput {
  id: string;
  timestamp: Date;
  isStarred: boolean;
}

/**
 * Optimistic Message Star Hook
 *
 * Pattern: Update isStarred immediately, API confirms in background
 * Benefits:
 * - Star/unstar responds instantly (< 10ms vs 300-600ms)
 * - Auto-reverts on error
 *
 * Similar to: WhatsApp's star messages, Slack's save messages
 */
export function useOptimisticMessageStar() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.messages.toggleStar.mutationOptions({
      onMutate: async (input: StarMessageInput) => {
        // 1. Cancel outgoing queries
        await queryClient.cancelQueries({
          queryKey: [["messages", "list"]],
        });

        // 2. Snapshot previous value for rollback
        let previousIsStarred = false;

        // Find all messages.list queries
        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["messages", "list"]],
          exact: false,
        });

        queries.forEach((query) => {
          const queryState = query.state.data as {
            pages: {
              items: {
                message: { id: string; isStarred?: boolean; [key: string]: unknown };
                attachment: Record<string, unknown> | null;
                isOwnMessage: boolean;
              }[];
              nextCursor: string | undefined;
              hasMore: boolean;
            }[];
            pageParams: unknown[];
          } | undefined;

          if (!queryState?.pages) return;

          // Find message and update
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item.message.id === input.id) {
                previousIsStarred = item.message.isStarred ?? false;
                return {
                  ...item,
                  message: {
                    ...item.message,
                    isStarred: input.isStarred,
                  },
                };
              }
              return item;
            }),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });

          // Force re-render WITHOUT refetch
          void queryClient.invalidateQueries({
            queryKey: query.queryKey,
            refetchType: "none",
          });
        });

        // Return context for rollback
        return { previousIsStarred, messageId: input.id };
      },
      onError: (error, _input, context) => {
        // Rollback on error
        if (context) {
          const queries = queryClient.getQueryCache().findAll({
            queryKey: [["messages", "list"]],
            exact: false,
          });

          queries.forEach((query) => {
            const queryState = query.state.data as {
              pages: {
                items: {
                  message: { id: string; isStarred?: boolean; [key: string]: unknown };
                  attachment: Record<string, unknown> | null;
                  isOwnMessage: boolean;
                }[];
                nextCursor: string | undefined;
                hasMore: boolean;
              }[];
              pageParams: unknown[];
            } | undefined;

            if (!queryState?.pages) return;

            const newPages = queryState.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => {
                if (item.message.id === context.messageId) {
                  return {
                    ...item,
                    message: {
                      ...item.message,
                      isStarred: context.previousIsStarred,
                    },
                  };
                }
                return item;
              }),
            }));

            queryClient.setQueryData(query.queryKey, {
              ...queryState,
              pages: newPages,
              pageParams: queryState.pageParams,
            });

            void queryClient.invalidateQueries({
              queryKey: query.queryKey,
              refetchType: "none",
            });
          });
        }

        toast.error(error.message || "Erro ao favoritar mensagem");
      },
      onSuccess: () => {
        // Success! No need to refetch - optimistic update already applied
      },
    })
  );
}
