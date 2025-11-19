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
import { useInfiniteQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { isSameDay } from "date-fns";

import { cn } from "@manylead/ui";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useTRPC } from "~/lib/trpc/react";
import { ChatMessage } from "./chat-message";
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
  const previousMessageCountRef = useRef<number>(0);
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const [isTyping, setIsTyping] = useState(false);

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
    sender: item.isOwnMessage ? ("agent" as const) : ("contact" as const),
    timestamp: item.message.timestamp,
    status: item.message.status as
      | "pending"
      | "sent"
      | "delivered"
      | "read"
      | undefined,
  }));

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
          // CRITICAL: Store scroll height BEFORE fetching
          if (scrollViewportRef.current) {
            previousScrollHeightRef.current =
              scrollViewportRef.current.scrollHeight;
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

  // Auto-scroll: ALWAYS when YOU send, only if near bottom when receiving
  const previousMessagesLengthRef = useRef(messages.length);
  const lastMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentLength = messages.length;
    const previousLength = previousMessagesLengthRef.current;

    // Only scroll if messages were ADDED (not initial load, not loading older messages)
    if (
      currentLength > previousLength &&
      !isInitialLoadRef.current &&
      !isFetchingNextPage
    ) {
      const lastMessage = messages[messages.length - 1];

      // Check if this is a NEW message we haven't seen before
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
      const currentScrollHeight = viewport.scrollHeight;
      const heightDifference =
        currentScrollHeight - previousScrollHeightRef.current;

      // Adjust scroll position to maintain visual position
      if (heightDifference > 0) {
        viewport.scrollTop = viewport.scrollTop + heightDifference;
      }

      // Reset for next load
      previousScrollHeightRef.current = 0;
      previousMessageCountRef.current = messages.length;
    }
  }, [messages.length]);

  return (
    <div className={cn("relative space-y-4", className)} {...props}>
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
              <ChatMessage
                message={message}
                showAvatar={showAvatar}
              />
            </Fragment>
          );
        })}

        {/* Typing indicator - estilo WhatsApp */}
        {isTyping && <ChatMessageTypingIndicator />}

        {/* Anchor for scroll-to-bottom */}
        <div ref={messagesEndRef} className="h-4" />
      </div>
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
