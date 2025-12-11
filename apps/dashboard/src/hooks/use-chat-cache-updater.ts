/**
 * useChatCacheUpdater - DRY helper for updating all chat queries
 *
 * Big Tech Pattern: Centralized cache update logic (Slack, Discord)
 *
 * Benefits:
 * - DRY: Single place for all chat cache updates
 * - Type-safe: TypeScript ensures correct data structure
 * - Fast: O(1) lookup via ChatCacheManager + O(n) query update
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { chatCacheManager } from "~/lib/cache/chat-cache-manager";

interface ChatItem {
  chat: {
    id: string;
    lastMessageContent?: string;
    lastMessageAt?: Date;
    lastMessageStatus?: string;
    lastMessageSender?: string;
    unreadCount?: number;
    assignedToId?: string | null;
    status?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ChatQueryState {
  items: ChatItem[];
  pages: unknown[];
  pageParams: unknown[];
}

type ChatUpdates = Partial<ChatItem["chat"]> | ((current: ChatItem["chat"]) => Partial<ChatItem["chat"]>);

export function useChatCacheUpdater() {
  const queryClient = useQueryClient();

  /**
   * Update a specific chat across all queries
   */
  const updateChatInCache = useCallback(
    (chatId: string, updates: ChatUpdates) => {
      // Find all chats.list queries
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["chats", "list"]],
        exact: false,
      });

      // Compute updates ONCE before loop (prevent duplicate callback execution)
      let resolvedUpdates: Partial<ChatItem["chat"]> | null = null;
      let updatedAnyQuery = false;

      queries.forEach((query) => {
        const queryState = query.state.data as ChatQueryState | undefined;
        if (!queryState?.items) return;

        // Find chat index
        const chatIndex = queryState.items.findIndex((item) => item.chat.id === chatId);
        if (chatIndex === -1) {
          return;
        }

        const chatItem = queryState.items[chatIndex];
        if (!chatItem) return;

        const currentChat = chatItem.chat;

        // Compute updates ONCE (on first iteration only)
        if (resolvedUpdates === null) {
          resolvedUpdates = typeof updates === "function" ? updates(currentChat) : updates;

          // Update normalized cache once
          chatCacheManager.update(chatId, resolvedUpdates);
        }

        // IMPORTANT: Create completely new chat object to ensure React detects change
        // Shallow spread isn't enough - need new reference at every level
        const updatedChatItem = {
          ...chatItem,
          chat: {
            ...currentChat,
            ...resolvedUpdates,
          },
        } as ChatItem;

        // If lastMessageAt was updated, reorder the list
        let newItems: ChatItem[];
        if (resolvedUpdates.lastMessageAt) {
          // Remove chat from current position
          const itemsWithoutCurrent = queryState.items.filter((item) => item.chat.id !== chatId);

          // Find correct position based on lastMessageAt (descending order)
          const newLastMessageAt = new Date(resolvedUpdates.lastMessageAt);
          let insertIndex = 0;

          for (let i = 0; i < itemsWithoutCurrent.length; i++) {
            const itemLastMessageAt = itemsWithoutCurrent[i]?.chat.lastMessageAt;
            if (itemLastMessageAt && new Date(itemLastMessageAt) > newLastMessageAt) {
              insertIndex = i + 1;
            } else {
              break;
            }
          }

          // Insert at correct position
          newItems = [
            ...itemsWithoutCurrent.slice(0, insertIndex),
            updatedChatItem,
            ...itemsWithoutCurrent.slice(insertIndex),
          ];
        } else {
          // Just update in place
          newItems = [...queryState.items];
          newItems[chatIndex] = updatedChatItem;
        }

        // Update cache data
        const newData = {
          pages: queryState.pages,
          pageParams: queryState.pageParams,
          items: newItems,
        };

        queryClient.setQueryData(query.queryKey, newData);

        updatedAnyQuery = true;
      });

      // Return whether any query was updated
      return updatedAnyQuery;
    },
    [queryClient]
  );

  /**
   * Remove chat from all queries (for archive/delete)
   */
  const removeChatFromCache = useCallback(
    (chatId: string) => {
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["chats", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as ChatQueryState | undefined;
        if (!queryState?.items) return;

        const newItems = queryState.items.filter((item) => item.chat.id !== chatId);

        // Only update if chat was actually removed
        if (newItems.length !== queryState.items.length) {
          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            items: newItems,
          });
        }
      });

      // Remove from normalized cache
      chatCacheManager.delete(chatId);
    },
    [queryClient]
  );

  /**
   * Add chat to cache (for new chats)
   */
  const addChatToCache = useCallback(
    (chat: ChatItem) => {
      // Add to normalized cache
      chatCacheManager.set(chat.chat.id, chat.chat);

      // Add to first query only (avoid duplicates)
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["chats", "list"]],
        exact: false,
      });

      const firstQuery = queries[0];
      if (firstQuery) {
        const queryState = firstQuery.state.data as ChatQueryState | undefined;

        if (queryState?.items) {
          // Check if chat already exists
          const exists = queryState.items.some((item) => item.chat.id === chat.chat.id);
          if (!exists) {
            queryClient.setQueryData(firstQuery.queryKey, {
              ...queryState,
              items: [chat, ...queryState.items],
            });
          }
        }
      }
    },
    [queryClient]
  );

  /**
   * Force re-render without refetch
   * setQueryData updates cache but doesn't always trigger re-render
   * This ensures components using the query re-render with updated data
   */
  const invalidateChatsWithoutRefetch = useCallback(() => {
    // Mark queries as stale to trigger re-render, but don't refetch
    void queryClient.invalidateQueries({
      queryKey: [["chats", "list"]],
      exact: false,
      refetchType: "none",
    });
  }, [queryClient]);

  /**
   * Invalidate active queries only (refetch visible tabs)
   */
  const invalidateActiveChats = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [["chats", "list"]],
      refetchType: "active",
    });
  }, [queryClient]);

  return {
    updateChatInCache,
    removeChatFromCache,
    addChatToCache,
    invalidateChatsWithoutRefetch,
    invalidateActiveChats,
  };
}
