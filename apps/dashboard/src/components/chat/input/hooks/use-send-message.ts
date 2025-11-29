"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";
import { useNotificationSound } from "~/hooks/use-notification-sound";

interface SendMessageOptions {
  chatId: string;
  content: string;
  metadata?: {
    repliedToMessageId: string;
    repliedToContent: string;
    repliedToSender: string;
  };
}

/**
 * Hook for sending messages with optimistic updates and cache management
 * Extracted from chat-input.tsx (lines 185-402)
 */
export function useSendMessage(chatId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();
  const { playNotificationSound } = useNotificationSound();

  // Mutation for sending text messages
  const sendMessageMutation = useMutation(
    trpc.messages.sendText.mutationOptions({
      onSuccess: (serverMessage, variables) => {
        // HYBRID APPROACH: Replace tempId with serverId
        const tempId = variables.tempId;

        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["messages", "list"]],
          exact: false,
        });

        queries.forEach((query) => {
          const queryState = query.state.data as {
            pages: {
              items: {
                message: Record<string, unknown>;
                attachment: Record<string, unknown> | null;
                isOwnMessage: boolean;
              }[];
              nextCursor: string | undefined;
              hasMore: boolean;
            }[];
            pageParams: unknown[];
          } | undefined;

          if (!queryState?.pages) return;

          // REPLACE tempId with serverId in cache
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.message.id === tempId
                ? {
                    ...item,
                    message: {
                      ...serverMessage,
                      _isOptimistic: false,
                    } as unknown as Record<string, unknown>,
                  }
                : item
            ),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });

          // Force re-render
          void queryClient.invalidateQueries({
            queryKey: query.queryKey,
            refetchType: "none",
          });
        });

        // Register serverId in dedup store
        register(serverMessage.id);

        // Invalidate chats list
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });

        // Play notification sound
        playNotificationSound();
      },
      onError: (error, variables) => {
        // REMOVE optimistic message on error
        const tempId = variables.tempId;

        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["messages", "list"]],
          exact: false,
        });

        queries.forEach((query) => {
          const queryState = query.state.data as {
            pages: {
              items: {
                message: Record<string, unknown>;
                attachment: Record<string, unknown> | null;
                isOwnMessage: boolean;
              }[];
              nextCursor: string | undefined;
              hasMore: boolean;
            }[];
            pageParams: unknown[];
          } | undefined;

          if (!queryState?.pages) return;

          // Remove optimistic message
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.message.id !== tempId),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });
        });

        toast.error("Erro ao enviar mensagem", {
          description: error.message,
        });
      },
    })
  );

  /**
   * Send a single message with optimistic update
   */
  const sendMessage = async (options: SendMessageOptions) => {
    const { content, metadata } = options;

    // Generate tempId BEFORE sending (UUIDv7 - time-sortable)
    const tempId = uuidv7();

    // Format message with signature: **UserName**\nContent (same as backend)
    const userName = session.user.name;
    const formattedContent = `**${userName}**\n${content}`;

    const tempMessage = {
      id: tempId,
      chatId,
      content: formattedContent,
      timestamp: new Date(),
      status: "pending" as const,
      sender: "agent" as const,
      senderId: null as string | null,
      messageType: "text" as const,
      isOwnMessage: true,
      _isOptimistic: true,
    };

    // Add to cache BEFORE mutateAsync (instant UI update)
    const queries = queryClient.getQueryCache().findAll({
      queryKey: [["messages", "list"]],
      exact: false,
    });

    queries.forEach((query) => {
      const queryState = query.state.data as {
        pages: {
          items: {
            message: Record<string, unknown>;
            attachment: Record<string, unknown> | null;
            isOwnMessage: boolean;
          }[];
          nextCursor: string | undefined;
          hasMore: boolean;
        }[];
        pageParams: unknown[];
      } | undefined;

      if (!queryState?.pages) return;

      const newPages = [...queryState.pages];
      const firstPage = newPages[0];

      if (firstPage) {
        newPages[0] = {
          ...firstPage,
          items: [
            ...firstPage.items,
            {
              message: tempMessage as unknown as Record<string, unknown>,
              attachment: null,
              isOwnMessage: true,
            },
          ],
        };

        queryClient.setQueryData(query.queryKey, {
          ...queryState,
          pages: newPages,
          pageParams: queryState.pageParams,
        });
      }
    });

    // Register tempId in dedup store
    register(tempId);

    // Send to server (with tempId and repliedToMessageId)
    await sendMessageMutation.mutateAsync({
      chatId,
      content,
      tempId,
      metadata,
    });
  };

  return {
    sendMessage,
    isSending: sendMessageMutation.isPending,
  };
}
