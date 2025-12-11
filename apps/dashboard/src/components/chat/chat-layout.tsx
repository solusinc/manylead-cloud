"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@manylead/ui";

import { ChatSocketProvider, useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useSocketListener } from "~/hooks/chat/use-socket-listener";
import { useNotificationSound } from "~/hooks/use-notification-sound";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";
import { useChatCacheUpdater } from "~/hooks/use-chat-cache-updater";
import type { WhatsAppMessageStatusEvent } from "~/hooks/use-chat-socket";
import { chatListInvalidator } from "~/utils/batch-invalidator";
import { ChatSidebar } from "./sidebar";
import { ChatWindowEmpty } from "./window";

export function ChatLayout({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { hasChatSelected?: boolean }) {
  return (
    <ChatSocketProvider>
      <ChatLayoutInner hasChatSelected={hasChatSelected} className={className} {...props}>
        {children}
      </ChatLayoutInner>
    </ChatSocketProvider>
  );
}

function ChatLayoutInner({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { hasChatSelected?: boolean }) {
  const queryClient = useQueryClient();
  const session = useServerSession();
  const socket = useChatSocketContext();
  const { register, isAnyProcessed } = useMessageDeduplication();
  const { playNotificationSound } = useNotificationSound();
  const { data: currentAgent } = useCurrentAgent();
  const { updateChatInCache, invalidateChatsWithoutRefetch, invalidateActiveChats } = useChatCacheUpdater();

  // Conectar ao Socket.io quando o layout montar
  useEffect(() => {
    const organizationId = session.session.activeOrganizationId;
    if (organizationId) {
      void socket.connect(organizationId);
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.session.activeOrganizationId]);

  // Escutar eventos de chat

  // 1. Quando uma nova mensagem chega - atualizar cache
  useSocketListener(
    socket,
    'onMessageNew',
    (event) => {
      // HYBRID APPROACH: Triple deduplication (dedup store + cache + tempId)
      // REMOVED setTimeout - instant processing with robust deduplication

      const messageData = event.message;
      const serverId = messageData.id as string;
      const metadata = messageData.metadata as { systemEventType?: string; tempId?: string } | null;
      const tempId = metadata?.tempId;

      // === EARLY DEDUP CHECK: Check if already processed ===
      if (isAnyProcessed([serverId])) {
        return; // Already processed this message
      }

      // Register immediately to prevent duplicate processing
      register(serverId);
      if (tempId) register(tempId);

      // Find all queries for messages.list
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

        // Extract chatId from query key to check if this message belongs to this query
        // tRPC query key structure: [["messages", "list"], { input: { chatId: "..." } }]
        const queryKey = query.queryKey as unknown[];
        const queryOptions = queryKey[1] as { input?: { chatId?: string } } | undefined;
        const queryChatId = queryOptions?.input?.chatId;

        // Only update if message belongs to this chat
        if (!queryChatId || messageData.chatId !== queryChatId) return;

        // === LAYER 1: Check if serverId already exists (avoid duplicate real messages) ===
        const serverMessageExists = queryState.pages.some((page) =>
          page.items.some((item) => item.message.id === serverId)
        );

        if (serverMessageExists) {
          return; // Real message already in cache
        }

        // === LAYER 2: Check if optimistic message exists (tempId) ===
        // If tempId exists in metadata, look for optimistic message and REPLACE it
        let hasOptimisticMessage = false;
        if (tempId) {
          hasOptimisticMessage = queryState.pages.some((page) =>
            page.items.some((item) => item.message.id === tempId)
          );
        }

        const newPages = [...queryState.pages];

        if (hasOptimisticMessage && tempId) {
          // REPLACE optimistic message with real one
          const updatedPages = newPages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.message.id === tempId
                ? {
                    message: messageData,
                    attachment: (messageData as { attachment?: Record<string, unknown> }).attachment ?? null,
                    isOwnMessage: currentAgent ? messageData.senderId === currentAgent.id : false,
                  }
                : item
            ),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: updatedPages,
            pageParams: queryState.pageParams,
          });
        } else {
          // ADD new message (no optimistic message exists)
          // Filtrar mensagens de sistema de rating/closing (não devem aparecer na lista)
          // NOTA: welcome_message DEVE aparecer na lista
          const hiddenSystemEventTypes = ["rating_request", "rating_thanks", "closing_message", "rating_value"];
          const isHiddenSystemMessage =
            messageData.messageType === "system" &&
            metadata?.systemEventType &&
            hiddenSystemEventTypes.includes(metadata.systemEventType);

          if (isHiddenSystemMessage) {
            return; // Não adicionar mensagem escondida ao cache
          }

          const firstPage = newPages[0];

          if (firstPage) {
            newPages[0] = {
              ...firstPage,
              items: [
                ...firstPage.items,
                {
                  message: messageData,
                  attachment: (messageData as { attachment?: Record<string, unknown> }).attachment ?? null,
                  isOwnMessage: currentAgent ? messageData.senderId === currentAgent.id : false,
                },
              ],
            };

            queryClient.setQueryData(query.queryKey, {
              ...queryState,
              pages: newPages,
              pageParams: queryState.pageParams,
            });

          }
        }

        // Force re-render without refetch
        void queryClient.invalidateQueries({
          queryKey: query.queryKey,
          refetchType: "none",
        });
      });

      // Compute isOwnMessage once for reuse
      const isOwnMessage = currentAgent && messageData.senderId === currentAgent.id;

      // ALWAYS update chat cache in sidebar (even if chat not open)
      const chatId = messageData.chatId as string;

      // System messages (welcome, out_of_hours) should show as "agent" in sidebar
      const systemMessageTypes = ["welcome_message", "out_of_hours_message"];
      const isSystemMessageFromAgent =
        messageData.sender === "system" &&
        metadata?.systemEventType &&
        systemMessageTypes.includes(metadata.systemEventType);

      const chatWasUpdated = updateChatInCache(chatId, (current) => ({
        lastMessageContent: messageData.content as string,
        lastMessageAt: new Date(messageData.timestamp as string),
        lastMessageSender: isSystemMessageFromAgent ? "agent" : (messageData.sender as string),
        lastMessageStatus: messageData.status as string,
        // Increment unreadCount if message is NOT from current agent
        unreadCount: isOwnMessage ? current.unreadCount : (current.unreadCount ?? 0) + 1,
      }));

      // Batch invalidate with 50ms debounce (5 messages in 200ms = 1 API call instead of 5)
      chatListInvalidator.invalidate("message-new", () => {
        // If chat was found in cache, just force re-render
        // If not found (new chat), do full refetch
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (chatWasUpdated) {
          invalidateChatsWithoutRefetch(); // Force re-render WITHOUT refetch
        } else {
          invalidateActiveChats(); // New chat - need refetch
        }
      });

      // Play notification sound for:
      // 1. Messages from other agents
      // 2. Own audio messages (async processing - feedback needed)
      // Don't play sound for comments, welcome messages, or rating-related messages
      const isAudioMessage = messageData.messageType === "audio";
      const isComment = messageData.messageType === "comment";
      const silentSystemEventTypes = ["welcome_message", "rating_value", "rating_thanks"];
      const isSilentSystemMessage = metadata?.systemEventType && silentSystemEventTypes.includes(metadata.systemEventType);

      if (currentAgent && !isComment && !isSilentSystemMessage && (!isOwnMessage || isAudioMessage)) {
        playNotificationSound();
      }
    },
    [queryClient, register, isAnyProcessed, playNotificationSound, currentAgent?.id, updateChatInCache]
  );

  // 2. Quando um novo chat é criado - batch invalidate
  useSocketListener(
    socket,
    'onChatCreated',
    () => {
      // Batch invalidate with debounce (multiple chats created in burst)
      chatListInvalidator.invalidate("chat-created", () => {
        invalidateActiveChats(); // Refetch active queries only
      });
    },
    [invalidateActiveChats]
  );

  // 3. Quando um chat é atualizado (assign/transfer) - batch invalidate
  useSocketListener(
    socket,
    'onChatUpdated',
    (event) => {
      const chatId = event.chat.id as string;
      const eventId = `chat-updated-${chatId}`;

      // Dedup check to prevent processing same event twice
      if (isAnyProcessed([eventId])) {
        return;
      }

      register(eventId);

      // Batch invalidate with debounce (multiple updates in burst)
      chatListInvalidator.invalidate("chat-updated", () => {
        // Refetch active chats (assign/transfer changes visibility)
        invalidateActiveChats();

        // Invalidate archived count to update badge
        void queryClient.invalidateQueries({
          queryKey: [["chats", "getArchivedCount"]],
        });

        // Invalidate messages to fetch system messages (transfer, assignment, etc)
        void queryClient.invalidateQueries({
          queryKey: [["messages"]],
          refetchType: "none", // Just mark as stale - socket will bring new message
        });
      });
    },
    [queryClient, invalidateActiveChats, register, isAnyProcessed]
  );

  // 4. Quando uma mensagem é atualizada (status read/delivered) - update cache directly
  useSocketListener(
    socket,
    'onMessageUpdated',
    (event) => {
      const message = event.message as {
        id: string;
        chatId: string;
        timestamp: string;
        status: string;
        sender: string;
      };

      // Update cache using helper (O(1) + O(n) instead of O(n*m))
      updateChatInCache(message.chatId, (current) => {
        // Only update if this is the last message (timestamp check)
        const isLastMessage =
          !current.lastMessageAt ||
          new Date(message.timestamp).getTime() >= new Date(current.lastMessageAt).getTime();

        if (!isLastMessage) return {};

        return {
          lastMessageStatus: message.status,
          lastMessageSender: message.sender,
        };
      });

      // Force re-render WITHOUT refetch
      invalidateChatsWithoutRefetch();
    },
    [updateChatInCache, invalidateChatsWithoutRefetch]
  );

  // 5. WhatsApp message status updates (ticks) - atualizar mensagens e sidebar
  useSocketListener(
    socket,
    'onWhatsAppMessageStatus',
    (event: WhatsAppMessageStatusEvent) => {
      const eventId = `whatsapp-status-${event.messageId}-${event.status}`;

      // Dedup check
      if (isAnyProcessed([eventId])) {
        return;
      }

      register(eventId);

      // Update message in messages cache
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

        const newPages = queryState.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.message.id === event.messageId) {
              return {
                ...item,
                message: {
                  ...item.message,
                  status: event.status,
                  deliveredAt: event.status === "delivered" || event.status === "read" ? new Date(event.timestamp) : item.message.deliveredAt,
                  readAt: event.status === "read" ? new Date(event.timestamp) : item.message.readAt,
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

      // Update lastMessageStatus in chats cache (for sidebar)
      const wasUpdated = updateChatInCache(event.chatId, (current) => {
        // Only update if this is the last message (compare timestamps)
        const isLastMessage =
          !current.lastMessageAt ||
          new Date(event.timestamp).getTime() >= new Date(current.lastMessageAt).getTime();

        if (!isLastMessage) return {};

        return {
          lastMessageStatus: event.status,
        };
      });

      // Always invalidate to force re-render
      // If chat was found, use refetchType: none (just re-render with cache)
      // If not found, do full refetch
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (wasUpdated) {
        invalidateChatsWithoutRefetch();
      } else {
        invalidateActiveChats();
      }
    },
    [queryClient, updateChatInCache, invalidateActiveChats, register, isAnyProcessed]
  );

  // 6. Quando logo de contato cross-org é atualizado - batch invalidate
  useSocketListener(
    socket,
    'onContactLogoUpdated',
    () => {
      // Batch invalidate logo updates (multiple contacts may update)
      chatListInvalidator.invalidate("contact-logo", () => {
        invalidateActiveChats(); // Refetch to get updated logo
      });
    },
    [invalidateActiveChats]
  );

  return (
    <div className={cn("flex h-full overflow-hidden", className)} {...props}>
      <ChatLayoutSidebar hasChatSelected={hasChatSelected} />
      <ChatLayoutMain hasChatSelected={hasChatSelected}>
        {children ?? <ChatWindowEmpty />}
      </ChatLayoutMain>
    </div>
  );
}

export function ChatLayoutSidebar({
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"aside"> & { hasChatSelected?: boolean }) {
  return (
    <aside
      className={cn(
        "bg-background w-full md:w-[445px] shrink-0 border-r flex",
        hasChatSelected && "hidden lg:flex", // Hide on mobile/tablet when chat is selected
        className,
      )}
      {...props}
    >
      <ChatSidebar />
    </aside>
  );
}

export function ChatLayoutMain({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"main"> & { hasChatSelected?: boolean }) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col overflow-hidden",
        !hasChatSelected && "hidden md:flex", // Hide on mobile when no chat selected, show on tablet/desktop
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
