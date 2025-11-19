"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@manylead/ui";

import { ChatSocketProvider, useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
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
  useEffect(() => {
    if (!socket.isConnected) return;

    // Quando um novo chat é criado ou uma nova mensagem chega
    const unsubscribeNewMessage = socket.onMessageNew((event) => {
      // HYBRID APPROACH: Triple deduplication (dedup store + cache + tempId)
      // REMOVED setTimeout - instant processing with robust deduplication

      const messageData = event.message;
      const serverId = messageData.id as string;
      const tempId = (messageData.metadata as Record<string, unknown> | undefined)?.tempId as string | undefined;

      // === LAYER 1: Dedup Store (Primary) ===
      // Check if serverId OR tempId was already processed
      if (isAnyProcessed([serverId, tempId])) {
        console.log("[Dedup] Message already processed:", { serverId, tempId });
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
          console.log("[Dedup] Message exists in cache:", { serverId, tempId });
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
    });

    const unsubscribeChatCreated = socket.onChatCreated(() => {
      void queryClient.invalidateQueries({
        queryKey: [["chats"]],
        refetchType: "active",
      });
    });

    const unsubscribeChatUpdated = socket.onChatUpdated(() => {
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
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeChatCreated();
      unsubscribeChatUpdated();
    };
  }, [socket, socket.isConnected, queryClient, register, isAnyProcessed]);

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
