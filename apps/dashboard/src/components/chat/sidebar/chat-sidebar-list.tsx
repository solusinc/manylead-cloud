"use client";

import { cn } from "@manylead/ui";
import { Skeleton } from "@manylead/ui/skeleton";
import { useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatSidebarItem } from "./chat-sidebar-item";
import { useTRPC } from "~/lib/trpc/react";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { useChatSearchStore, useIsSearchActive } from "~/stores/use-chat-search-store";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";

type FilterType = "all" | "pending" | "open" | "mine";

export function ChatSidebarList({
  activeFilter,
  className,
  ...props
}: {
  activeFilter?: FilterType;
} & React.ComponentProps<"div">) {
  const parentRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const activeChatId = params.chatId as string | undefined;
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const session = useServerSession();
  const isSearchActive = useIsSearchActive();
  const searchTerm = useChatSearchStore((state) => state.searchTerm);
  const showUnreadOnly = useChatFiltersStore((state) => state.showUnreadOnly);
  const headerFilters = useChatFiltersStore((state) => state.headerFilters);

  // Estado para rastrear quem está digitando (chatId -> true/false)
  const [typingChats, setTypingChats] = useState<Set<string>>(new Set());

  // Buscar agent atual para obter o ID quando o filtro for "mine"
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );

  // Determinar os parâmetros do filtro baseado em headerFilters (prioridade) ou activeFilter
  const filterParams = (() => {
    // PRIORIDADE: Se headerFilters.status está definido (não "all"), usar ele
    if (headerFilters.status !== "all") {
      return { status: headerFilters.status };
    }

    // Caso contrário, usar activeFilter dos tabs
    if (activeFilter === "pending") {
      return { status: "pending" as const };
    }
    if (activeFilter === "open") {
      return { status: "open" as const };
    }
    if (activeFilter === "mine" && currentAgent?.id) {
      return { assignedTo: currentAgent.id };
    }
    // "all" ou default: sem filtros específicos
    return {};
  })();

  // Buscar chats da API com filtros + busca
  const { data: chatsData, isLoading } = useQuery(
    trpc.chats.list.queryOptions({
      ...filterParams,
      search: isSearchActive ? searchTerm : undefined,
      unreadOnly: showUnreadOnly || undefined,
      tagIds: headerFilters.tagIds.length > 0 ? headerFilters.tagIds : undefined,
      agentIds: headerFilters.agentIds.length > 0 ? headerFilters.agentIds : undefined,
      departmentIds: headerFilters.departmentIds.length > 0 ? headerFilters.departmentIds : undefined,
      messageSources: headerFilters.messageSources.length > 0 ? headerFilters.messageSources : undefined,
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
      name: item.contact?.customName ?? item.contact?.name ?? "Sem nome",
      avatar: item.contact?.avatar ?? null,
    },
    lastMessage: item.chat.lastMessageContent ?? "",
    lastMessageAt: item.chat.lastMessageAt ?? item.chat.createdAt,
    unreadCount: item.chat.unreadCount,
    status: item.chat.status as "open" | "closed" | "pending",
    messageSource: item.chat.messageSource as "whatsapp" | "internal",
    tags: item.tags,
    assignedAgentName: item.assignedAgentName,
  })) ?? [];

  const virtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 5,
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-0", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4", className)}>
        <p className="text-muted-foreground text-center text-sm">
          {isSearchActive || showUnreadOnly ? (
            "Nenhuma sessão encontrada..."
          ) : (
            <>
              Nenhuma conversa ainda.
              <br />
              Clique no + para iniciar uma nova conversa.
            </>
          )}
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
