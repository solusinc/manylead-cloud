import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketListener } from "~/hooks/chat/use-socket-listener";
import type { UseChatSocketReturn } from "~/hooks/use-chat-socket";

interface InfiniteQueryData {
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
}

export interface UseMessageSocketReturn {
  isTyping: boolean;
}

export function useMessageSocket(
  socket: UseChatSocketReturn,
  chatId: string
): UseMessageSocketReturn {
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);

  /**
   * Helper para atualizar mensagem no cache (DRY)
   */
  const updateMessageInCache = useCallback(
    (
      messageId: string,
      updater: (message: Record<string, unknown>) => Record<string, unknown>
    ) => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["messages", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as InfiniteQueryData | undefined;
        if (!queryState?.pages) return;

        const newPages = queryState.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.message.id === messageId
              ? { ...item, message: updater(item.message) }
              : item
          ),
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
    },
    [queryClient]
  );

  // Typing events
  useSocketListener(
    socket,
    "onTypingStart",
    (data) => {
      if (data.chatId === chatId) setIsTyping(true);
    },
    [chatId]
  );

  useSocketListener(
    socket,
    "onTypingStop",
    (data) => {
      if (data.chatId === chatId) setIsTyping(false);
    },
    [chatId]
  );

  // Message updated
  useSocketListener(
    socket,
    "onMessageUpdated",
    (event) => {
      if (event.message.chatId === chatId) {
        updateMessageInCache(event.message.id as string, (msg) => ({
          ...msg,
          status: event.message.status,
          isStarred: event.message.isStarred,
          readAt: event.message.readAt,
          content: event.message.content,
          isEdited: event.message.isEdited,
          editedAt: event.message.editedAt,
          isDeleted: event.message.isDeleted,
        }));
      }
    },
    [chatId, updateMessageInCache]
  );

  // Message deleted
  useSocketListener(
    socket,
    "onMessageDeleted",
    (event) => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["messages", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as InfiniteQueryData | undefined;
        if (!queryState?.pages) return;

        const newPages = queryState.pages.map((page) => ({
          ...page,
          items: page.items.filter(
            (item) => item.message.id !== event.message.id
          ),
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
    },
    [queryClient]
  );

  return { isTyping };
}
