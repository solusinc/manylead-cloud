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
  isRecording: boolean;
}

export function useMessageSocket(
  socket: UseChatSocketReturn,
  chatId: string
): UseMessageSocketReturn {
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

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
          items: page.items.map((item) => {
            // Match by serverId OR tempId (for optimistic updates)
            const itemTempId = (item.message.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;
            const matchesById = item.message.id === messageId;
            const matchesByTempId = itemTempId === messageId;

            if (matchesById || matchesByTempId) {
              return { ...item, message: updater(item.message) };
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

  // Recording events
  useSocketListener(
    socket,
    "onRecordingStart",
    (data) => {
      if (data.chatId === chatId) setIsRecording(true);
    },
    [chatId]
  );

  useSocketListener(
    socket,
    "onRecordingStop",
    (data) => {
      if (data.chatId === chatId) setIsRecording(false);
    },
    [chatId]
  );

  // Message created/updated - map tempId to real ID and update attachment
  useSocketListener(
    socket,
    "onMessageNew",
    (event) => {
      if (event.message.chatId !== chatId) return;

      const serverId = event.message.id as string;
      const tempId = (event.message.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;
      const hasAttachment = event.message.attachment as Record<string, unknown> | undefined;

      // Update message by serverId OR tempId
      const searchIds = [serverId, tempId].filter(Boolean) as string[];

      for (const searchId of searchIds) {
        // Update message in cache
        const queries = queryClient.getQueryCache().findAll({
          queryKey: [["messages", "list"]],
          exact: false,
        });

        queries.forEach((query) => {
          const queryState = query.state.data as InfiniteQueryData | undefined;
          if (!queryState?.pages) return;

          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              const itemTempId = (item.message.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;
              const matchesById = item.message.id === searchId;
              const matchesByTempId = itemTempId === searchId;

              if (matchesById || matchesByTempId) {
                return {
                  ...item,
                  message: {
                    ...item.message,
                    id: serverId, // Update to real server ID
                    timestamp: new Date(event.message.timestamp as string),
                  },
                  // Update attachment if present (worker completed download)
                  attachment: hasAttachment ?? item.attachment,
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
    },
    [chatId, queryClient]
  );

  // Message updated
  useSocketListener(
    socket,
    "onMessageUpdated",
    (event) => {
      if (event.message.chatId !== chatId) return;

      const serverId = event.message.id as string;
      const tempId = (event.message.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;

      // Try to find message by serverId first, then tempId
      const searchIds = [serverId, tempId].filter(Boolean) as string[];

      for (const searchId of searchIds) {
        updateMessageInCache(searchId, (msg) => ({
          ...msg,
          id: serverId, // Update to serverId if it was tempId
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

  // NOTE: WhatsApp message status (ticks) listener moved to ChatLayoutInner
  // to ensure it's always active, even when chat is not open

  return { isTyping, isRecording };
}
