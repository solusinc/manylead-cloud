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
      const tempId = (messageData.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;

      // === LAYER 1: Dedup Store (Primary) ===
      // Check if serverId OR tempId was already processed
      if (isAnyProcessed([serverId, tempId])) {
        return;
      }

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

        // === LAYER 2: Cache Check (Secondary) ===
        // Check if message exists in cache (by serverId OR tempId)
        const messageExists = queryState.pages.some((page) =>
          page.items.some((item) =>
            item.message.id === serverId ||
            (tempId && item.message.id === tempId)
          )
        );

        if (messageExists) {
          return;
        }

        // === PASSED ALL CHECKS: Add message ===

        // Register in dedup store
        register(serverId);
        if (tempId) register(tempId);

        // Add message to the FIRST page (index 0 - most recent messages)
        const newPages = [...queryState.pages];
        const firstPage = newPages[0];

        if (firstPage) {
          newPages[0] = {
            ...firstPage,
            items: [
              ...firstPage.items,
              {
                message: messageData,
                attachment: null,
                isOwnMessage: false, // Socket messages are from other users
              },
            ],
          };

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });

          // Force re-render without refetch
          void queryClient.invalidateQueries({
            queryKey: query.queryKey,
            refetchType: "none",
          });
        }
      });

      // Invalidate chats list to update last message preview
      void queryClient.invalidateQueries({
        queryKey: [["chats", "list"]],
      });

      // Play notification sound only for messages NOT from current agent
      // Own messages already play sound in use-send-message.ts
      if (currentAgent && messageData.senderId !== currentAgent.id) {
        playNotificationSound();
      }
    },
    [queryClient, register, isAnyProcessed, playNotificationSound, currentAgent?.id]
  );

  // 2. Quando um novo chat é criado - invalidar queries
  useSocketListener(
    socket,
    'onChatCreated',
    () => {
      void queryClient.invalidateQueries({
        queryKey: [["chats"]],
        refetchType: "active",
      });
    },
    [queryClient]
  );

  // 3. Quando um chat é atualizado (assign/transfer) - invalidar queries
  useSocketListener(
    socket,
    'onChatUpdated',
    () => {
      // Forçar refetch imediato quando chat é atualizado (assign/transfer)
      void queryClient.invalidateQueries({
        queryKey: [["chats"]],
        refetchType: "active",
      });

      // Invalidar mensagens também para buscar mensagens de sistema (transferência, etc)
      void queryClient.invalidateQueries({
        queryKey: [["messages"]],
        refetchType: "active",
      });
    },
    [queryClient]
  );

  // 4. Quando um chat é atualizado (unreadCount, lastMessage, etc) - invalidar cache
  useSocketListener(
    socket,
    'onChatUpdated',
    () => {
      // Invalidar cache de chats para refetch com dados atualizados
      void queryClient.invalidateQueries({
        queryKey: [["chats"]],
      });
    },
    [queryClient]
  );

  // 5. Quando uma mensagem é atualizada (status read/delivered) - atualizar sidebar
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

      // Atualizar o lastMessageStatus no cache do chat sidebar
      // Buscar todas as queries de chats e atualizar a que tem esse chat
      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["chats", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as {
          items: {
            chat: {
              id: string;
              lastMessageAt?: Date;
              lastMessageContent?: string;
              lastMessageStatus?: string;
              lastMessageSender?: string;
            };
          }[];
        } | undefined;

        if (!queryState?.items) return;

        // Procurar o chat que contém essa mensagem
        const chatIndex = queryState.items.findIndex((item) => item.chat.id === message.chatId);
        if (chatIndex === -1) return;

        const chat = queryState.items[chatIndex];
        if (!chat) return;

        // Atualizar SOMENTE se essa é a última mensagem do chat
        // (comparar timestamp)
        const isLastMessage =
          !chat.chat.lastMessageAt ||
          new Date(message.timestamp).getTime() >= new Date(chat.chat.lastMessageAt).getTime();

        if (isLastMessage) {
          const newItems = [...queryState.items];
          newItems[chatIndex] = {
            ...chat,
            chat: {
              ...chat.chat,
              lastMessageStatus: message.status,
              lastMessageSender: message.sender,
            },
          };

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            items: newItems,
          });

          // Force re-render
          void queryClient.invalidateQueries({
            queryKey: query.queryKey,
            refetchType: "none",
          });
        }
      });
    },
    [queryClient]
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
