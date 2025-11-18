"use client";

import { cn } from "@manylead/ui";
import { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatSidebarItem } from "./chat-sidebar-item";
import { useTRPC } from "~/lib/trpc/react";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";

export function ChatSidebarList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const parentRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const activeChatId = params.chatId as string | undefined;
  const trpc = useTRPC();
  const socket = useChatSocketContext();

  // Estado para rastrear quem está digitando (chatId -> true/false)
  const [typingChats, setTypingChats] = useState<Set<string>>(new Set());

  // Buscar chats da API
  const { data: chatsData, isLoading } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  // Escutar eventos de typing do Socket.io
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeTypingStart = socket.onTypingStart((data) => {
      setTypingChats((prev) => new Set(prev).add(data.chatId));
    });

    const unsubscribeTypingStop = socket.onTypingStop((data) => {
      setTypingChats((prev) => {
        const next = new Set(prev);
        next.delete(data.chatId);
        return next;
      });
    });

    return () => {
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket.isConnected]);

  const chats = chatsData?.items.map((item) => ({
    id: item.chat.id,
    contact: {
      name: item.contact?.name ?? "Sem nome",
      avatar: item.contact?.avatar ?? null,
    },
    lastMessage: item.chat.lastMessageContent ?? "",
    lastMessageAt: item.chat.lastMessageAt ?? item.chat.createdAt,
    unreadCount: item.chat.unreadCount,
    status: item.chat.status as "open" | "closed",
    messageSource: item.chat.messageSource as "whatsapp" | "internal",
  })) ?? [];

  const virtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  // Removido loading state - dados são prefetched no servidor
  if (chats.length === 0 && !isLoading) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4", className)}>
        <p className="text-muted-foreground text-center text-sm">
          Nenhuma conversa ainda.
          <br />
          Clique no + para iniciar uma nova conversa.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-y-auto", className)}
      {...props}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chat = chats[virtualItem.index];
          if (!chat) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatSidebarItem
                chat={chat}
                isActive={chat.id === activeChatId}
                isTyping={typingChats.has(chat.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
