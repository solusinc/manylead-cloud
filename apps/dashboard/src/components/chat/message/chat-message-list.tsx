"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronDown } from "lucide-react";
import { isSameDay } from "date-fns";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Skeleton } from "@manylead/ui/skeleton";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageFocusStore } from "~/stores/use-message-focus-store";
import { ChatMessage, ChatMessageSystem, ChatMessageComment } from "./chat-message";
import { ChatMessageDateDivider } from "./chat-message-date";

// Context to expose refetch function to parent components
const ChatMessageRefetchContext = createContext<(() => void) | null>(null);
export const useChatMessageRefetch = () =>
  useContext(ChatMessageRefetchContext);

const INITIAL_LIMIT = 50; // WhatsApp-style: 50 mensagens iniciais
const LOAD_MORE_LIMIT = 30; // WhatsApp-style: 30 mensagens por scroll

/**
 * Determine if a date divider should be shown between two messages
 * WhatsApp style: show divider when date changes
 */
function shouldShowDateDivider(
  currentTimestamp: Date,
  previousTimestamp?: Date
): boolean {
  // Always show divider for first message
  if (!previousTimestamp) {
    return true;
  }

  // Show divider if messages are on different days
  return !isSameDay(new Date(currentTimestamp), new Date(previousTimestamp));
}

export function ChatMessageList({
  chatId,
  className,
  ...props
}: {
  chatId: string;
} & React.ComponentProps<"div">) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const previousScrollHeightRef = useRef<number>(0);
  const previousScrollTopRef = useRef<number>(0);
  const previousMessageCountRef = useRef<number>(0);
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Buscar permissões do agent atual uma vez
  const { data: currentAgent } = useQuery(trpc.agents.getCurrent.queryOptions());

  // Garantir consistência entre server e client para evitar hydration errors
  const canEditMessages = isMounted ? (currentAgent?.permissions.messages.canEdit ?? false) : false;
  const canDeleteMessages = isMounted ? (currentAgent?.permissions.messages.canDelete ?? false) : false;

  // Marcar como mounted após hidratação
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Message focus store (para navegação de busca)
  const { focusMessageId, focusChatId, clearFocus } = useMessageFocusStore();
  const shouldFocusMessage = focusChatId === chatId && focusMessageId !== null;

  // TanStack Query handles ALL the complexity for us
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      ...trpc.messages.list.infiniteQueryOptions({
        chatId,
        firstPageLimit: INITIAL_LIMIT,
        limit: LOAD_MORE_LIMIT,
      }),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: Infinity, // NEVER mark as stale - we'll manually refetch first page only
      gcTime: Infinity, // Keep in cache forever
    });

  // Flatten pages - backend returns ASC, we reverse pages to get chronological order
  const messages = (
    data?.pages ? [...data.pages].reverse().flatMap((page) => page.items) : []
  ).map((item) => ({
    id: item.message.id,
    content: item.message.content,
    sender: item.message.sender === "system"
      ? ("system" as const)
      : item.isOwnMessage
        ? ("agent" as const)
        : ("contact" as const),
    timestamp: item.message.timestamp,
    status: item.message.status as
      | "pending"
      | "sent"
      | "delivered"
      | "read"
      | undefined,
    messageType: item.message.messageType as string | undefined,
    isStarred: item.message.isStarred,
    isDeleted: item.message.isDeleted,
    isEdited: item.message.isEdited,
    editedAt: item.message.editedAt as Date | null | undefined,
    readAt: item.message.readAt as Date | null | undefined,
    repliedToMessageId: item.message.repliedToMessageId as string | null | undefined,
    metadata: item.message.metadata as Record<string, unknown> | undefined,
    chatId,
  }));

  // Query para buscar mensagens ao redor de uma mensagem específica (navegação de busca)
  const { data: contextData, isLoading: _isLoadingContext } = useQuery({
    ...trpc.messages.getContext.queryOptions({
      chatId,
      messageId: focusMessageId ?? "",
      before: 30,
      after: 30,
    }),
    enabled: shouldFocusMessage,
  });

  // Efeito para processar o foco em uma mensagem
  useEffect(() => {
    if (!shouldFocusMessage || !focusMessageId) return;

    // Função para fazer scroll e highlight
    const scrollAndHighlight = (messageId: string) => {
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: "instant", block: "center" });
          messageElement.classList.add("reply-highlight");
          setTimeout(() => {
            messageElement.classList.remove("reply-highlight");
          }, 2000);
        }
        clearFocus();
      }, 100);
    };

    // Primeiro, verificar se a mensagem já está no DOM
    const existingElement = document.querySelector(`[data-message-id="${focusMessageId}"]`);
    if (existingElement) {
      scrollAndHighlight(focusMessageId);
      return;
    }

    // Se não está no DOM e temos dados de contexto, atualizar o cache
    if (contextData?.items && contextData.items.length > 0) {
      // Criar uma nova página com as mensagens do contexto
      const contextPage = {
        items: contextData.items,
        nextCursor: contextData.hasMoreBefore ? contextData.items[0]?.message.id : undefined,
        hasMore: contextData.hasMoreBefore,
      };

      // Substituir os dados no cache temporariamente
      const queryKey = trpc.messages.list.infiniteQueryKey({ chatId, firstPageLimit: 50, limit: 30 });
      queryClient.setQueryData(queryKey, {
        pages: [contextPage],
        pageParams: [null],
      });

      // Após atualizar, fazer scroll
      scrollAndHighlight(focusMessageId);
    }
  }, [shouldFocusMessage, focusMessageId, contextData, clearFocus, queryClient, trpc, chatId]);

  // Scroll to bottom on initial load
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Initial scroll to bottom ONLY on first load (not when loading more messages)
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    if (!isLoading && messages.length > 0 && isInitialLoadRef.current) {
      scrollToBottom("instant");
      isInitialLoadRef.current = false;
    }
  }, [chatId, isLoading, messages.length, scrollToBottom]);

  // Reset initial load flag when chat changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [chatId]);

  // INDUSTRY STANDARD: IntersectionObserver for loading older messages
  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Don't set up observer if no more pages or currently fetching
    if (!hasNextPage || !sentinelRef.current) {
      return;
    }

    // Find the Radix ScrollArea viewport
    let scrollViewport = sentinelRef.current.parentElement;
    while (
      scrollViewport &&
      !scrollViewport.hasAttribute("data-radix-scroll-area-viewport")
    ) {
      scrollViewport = scrollViewport.parentElement;
    }

    if (!scrollViewport) return;

    // Store viewport ref for scroll restoration
    scrollViewportRef.current = scrollViewport;

    // Create IntersectionObserver with the scroll viewport as root
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // When sentinel becomes visible AND we're not already fetching
        // Note: hasNextPage is already checked before observer setup (line 92)
        if (entry.isIntersecting && !isFetchingNextPage) {
          // CRITICAL: Store scroll height AND position BEFORE fetching
          if (scrollViewportRef.current) {
            previousScrollHeightRef.current =
              scrollViewportRef.current.scrollHeight;
            previousScrollTopRef.current =
              scrollViewportRef.current.scrollTop;
            previousMessageCountRef.current = messages.length;
          }

          void fetchNextPage();
        }
      },
      {
        root: scrollViewport, // Watch within Radix ScrollArea viewport
        rootMargin: "200px 0px 0px 0px", // Trigger 200px before sentinel is visible (smoother UX)
        threshold: 0, // Fire as soon as any part is visible
      },
    );

    // Start observing the sentinel
    observerRef.current.observe(sentinelRef.current);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages.length]);

  // Escutar eventos de typing para este chat
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeTypingStart = socket.onTypingStart((data) => {
      if (data.chatId === chatId) {
        setIsTyping(true);
      }
    });

    const unsubscribeTypingStop = socket.onTypingStop((data) => {
      if (data.chatId === chatId) {
        setIsTyping(false);
      }
    });

    return () => {
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
  }, [socket.isConnected, chatId, socket]);

  // Escutar eventos de message:updated para atualizar mensagens (star toggle, read status)
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeMessageUpdated = socket.onMessageUpdated((event) => {
      const messageChatId = event.message.chatId as string;
      if (messageChatId === chatId) {
        const updatedMessage = event.message;
        const messageId = updatedMessage.id as string;

        // Atualizar diretamente no cache ao invés de invalidar (mais rápido)
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

          // Atualizar a mensagem no cache
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.message.id === messageId
                ? {
                    ...item,
                    message: {
                      ...item.message,
                      status: updatedMessage.status,
                      isStarred: updatedMessage.isStarred,
                      readAt: updatedMessage.readAt,
                      content: updatedMessage.content,
                      isEdited: updatedMessage.isEdited,
                      editedAt: updatedMessage.editedAt,
                      isDeleted: updatedMessage.isDeleted,
                    } as Record<string, unknown>,
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
      }
    });

    return () => {
      unsubscribeMessageUpdated();
    };
  }, [socket.isConnected, chatId, socket, queryClient]);

  // Escutar eventos de message:deleted para remover mensagens deletadas
  useEffect(() => {
    if (!socket.isConnected) return;

    const unsubscribeMessageDeleted = socket.onMessageDeleted((event) => {
      const messageId = event.messageId;

      // Remover mensagem do cache
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

        // Remover a mensagem do cache
        const newPages = queryState.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.message.id !== messageId),
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
    });

    return () => {
      unsubscribeMessageDeleted();
    };
  }, [socket.isConnected, socket, queryClient]);

  // Auto-scroll: ALWAYS when YOU send, only if near bottom when receiving
  const previousMessagesLengthRef = useRef(messages.length);
  const lastMessageIdRef = useRef<string | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentLength = messages.length;
    const previousLength = previousMessagesLengthRef.current;

    // Skip auto-scroll if we're restoring scroll position after loading older messages
    const isRestoringScroll = previousScrollHeightRef.current > 0;

    // Only scroll if messages were ADDED (not initial load, not loading older messages)
    if (
      currentLength > previousLength &&
      !isInitialLoadRef.current &&
      !isFetchingNextPage &&
      !isRestoringScroll
    ) {
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];

      // Initialize firstMessageIdRef if not set
      if (!firstMessageIdRef.current && firstMessage) {
        firstMessageIdRef.current = firstMessage.id;
      }

      // Check if first message ID changed - means we loaded OLDER messages at the top
      // In this case, DON'T auto-scroll
      const loadedOlderMessages = firstMessage && firstMessage.id !== firstMessageIdRef.current;

      if (!loadedOlderMessages) {
        // Check if this is a NEW message we haven't seen before (at the bottom)
        if (lastMessage && lastMessage.id !== lastMessageIdRef.current) {
          const isOwnMessage = lastMessage.sender === "agent";

          // WhatsApp behavior: ALWAYS scroll when YOU send
          if (isOwnMessage) {
            scrollToBottom("instant");
          } else {
            // Only scroll if near bottom for received messages
            const viewport = scrollViewportRef.current;
            if (viewport) {
              const distanceFromBottom =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
              const isNearBottom = distanceFromBottom < 200;

              if (isNearBottom) {
                setTimeout(() => {
                  scrollToBottom("smooth");
                }, 50);
              }
            }
          }

          lastMessageIdRef.current = lastMessage.id;
        }
      }

      // Update firstMessageIdRef
      if (firstMessage) {
        firstMessageIdRef.current = firstMessage.id;
      }
    }

    previousMessagesLengthRef.current = currentLength;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isFetchingNextPage, scrollToBottom]);

  // Scroll quando typing indicator aparecer/desaparecer
  useEffect(() => {
    if (isTyping) {
      // Scroll suave quando alguém começa a digitar
      scrollToBottom("smooth");
    }
  }, [isTyping, scrollToBottom]);

  // Detectar scroll para mostrar/esconder botão
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollButton(distanceFromBottom > 300);
    };

    // Verificar posição inicial
    handleScroll();

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []); // Remover messages.length da dependency para evitar conflitos

  // CRITICAL: Restore scroll position after loading older messages
  // useLayoutEffect executes SYNCHRONOUSLY before browser paint - prevents visual jump
  useLayoutEffect(() => {
    // Skip if no viewport or no previous height stored
    if (!scrollViewportRef.current || previousScrollHeightRef.current === 0) {
      return;
    }

    // Only adjust if we loaded MORE messages (older messages were added)
    if (messages.length > previousMessageCountRef.current) {
      const viewport = scrollViewportRef.current;

      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        const currentScrollHeight = viewport.scrollHeight;
        const heightDifference =
          currentScrollHeight - previousScrollHeightRef.current;

        // Adjust scroll position to maintain visual position
        // Use the SAVED scrollTop, not the current one (which may have changed)
        if (heightDifference > 0) {
          viewport.scrollTop = previousScrollTopRef.current + heightDifference;
        }

        // Reset for next load
        previousScrollHeightRef.current = 0;
        previousScrollTopRef.current = 0;
        previousMessageCountRef.current = messages.length;
      });
    }
  }, [messages.length]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)} {...props}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              i % 2 === 0 ? "justify-start" : "justify-end"
            )}
          >
            <Skeleton className="h-16 w-64 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative space-y-4", className)} {...props}>
      {/* SENTINEL ELEMENT - IntersectionObserver watches this */}
      {hasNextPage && <div ref={sentinelRef} className="h-px" />}

      {/* Loading indicator at top - floating, doesn't push content */}
      {isFetchingNextPage && (
        <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
          <div className="bg-background/80 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((message, index) => {
          const prevMessage = messages[index - 1];
          const showAvatar =
            !prevMessage || prevMessage.sender !== message.sender;

          const showDateDivider = shouldShowDateDivider(
            message.timestamp,
            prevMessage?.timestamp
          );

          // Hide first badge when loading to prevent visual jump
          const shouldHideBadge = index === 0 && isFetchingNextPage;

          return (
            <Fragment key={message.id}>
              {showDateDivider && !shouldHideBadge && (
                <ChatMessageDateDivider date={new Date(message.timestamp)} />
              )}
              {message.messageType === "comment" ? (
                <ChatMessageComment message={message} />
              ) : message.sender === "system" ? (
                <ChatMessageSystem message={message} />
              ) : (
                <ChatMessage
                  message={message}
                  showAvatar={showAvatar}
                  canEditMessages={canEditMessages}
                  canDeleteMessages={canDeleteMessages}
                />
              )}
            </Fragment>
          );
        })}

        {/* Typing indicator - estilo WhatsApp */}
        {isTyping && <ChatMessageTypingIndicator />}

        {/* Anchor for scroll-to-bottom */}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Scroll to bottom button - Fixed position */}
      {showScrollButton && (
        <div className="fixed bottom-24 right-8 z-50 animate-in fade-in slide-in-from-bottom-2">
          <Button
            onClick={() => scrollToBottom("auto")}
            size="icon"
            variant="secondary"
            className="h-11 w-11 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-accent hover:bg-accent"
            aria-label="Ir para mensagens recentes"
          >
            <ChevronDown className="h-5 w-5 text-foreground/70" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Typing indicator - WhatsApp style
 * Usa o mesmo estilo do ChatMessageBubble para incoming messages
 */
function ChatMessageTypingIndicator() {
  return (
    <div className="mb-2 flex justify-start gap-2">
      <div className="bg-msg-incoming max-w-[65%] rounded-2xl rounded-bl-sm px-4 py-2">
        <div className="flex items-center gap-0.5">
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
          >
            •
          </span>
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
          >
            •
          </span>
          <span
            className="animate-bounce text-lg leading-none opacity-70"
            style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
          >
            •
          </span>
        </div>
      </div>
    </div>
  );
}
