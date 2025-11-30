"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isSameDay } from "date-fns";
import { ChevronDown, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Skeleton } from "@manylead/ui/skeleton";

import type { Message } from "./chat-message";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useTRPC } from "~/lib/trpc/react";
import { ChatMessage } from "./chat-message";
import { ChatMessageDateDivider } from "./chat-message-date";
import { ChatMessageComment, ChatMessageSystem } from "./chat-message-system";
// Hooks
import { useInfiniteScroll } from "./hooks/use-infinite-scroll";
import { useMessageData } from "./hooks/use-message-data";
import { useMessageFocus } from "./hooks/use-message-focus";
import { useMessageSocket } from "./hooks/use-message-socket";
import { useScrollManager } from "./hooks/use-scroll-manager";
import { SCROLL_CONSTANTS } from "./utils/scroll-rules";

/**
 * Determine if a date divider should be shown
 */
function shouldShowDateDivider(
  currentTimestamp: Date,
  previousTimestamp?: Date,
): boolean {
  if (!previousTimestamp) return true;
  return !isSameDay(new Date(currentTimestamp), new Date(previousTimestamp));
}

export function ChatMessageList({
  chatId,
  className,
  ...props
}: {
  chatId: string;
} & React.ComponentProps<"div">) {
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Track refs for auto-scroll logic
  const lastMessageIdRef = useRef<string | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const initialLoadTimestampRef = useRef<number>(0);

  // 1. Data Layer
  const {
    messages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessageData(chatId);

  // 2. Scroll Layer
  const scrollManager = useScrollManager();

  // 3. Infinite Scroll Layer
  const infiniteScroll = useInfiniteScroll(scrollManager.scrollViewportRef, {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    messageCount: messages.length,
    onLoadingStart: () => setIsLoadingOlder(true),
    onLoadingEnd: () => {
      setTimeout(
        () => setIsLoadingOlder(false),
        SCROLL_CONSTANTS.LOADING_PROTECTION_MS,
      );
    },
  });

  // 4. Socket Layer
  const { isTyping } = useMessageSocket(socket, chatId);

  // 5. Focus Layer
  useMessageFocus(chatId);

  // 6. Permissions
  const { data: currentAgent } = useQuery(
    trpc.agents.getCurrent.queryOptions(),
  );

  const canEditMessages = isMounted
    ? (currentAgent?.permissions.messages.canEdit ?? false)
    : false;
  const canDeleteMessages = isMounted
    ? (currentAgent?.permissions.messages.canDelete ?? false)
    : false;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset initial load flag when chat changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    initialLoadTimestampRef.current = Date.now();
    lastMessageIdRef.current = null;
    firstMessageIdRef.current = null;
  }, [chatId]);

  // Initial scroll to bottom
  useEffect(() => {
    if (
      !isLoading &&
      messages.length > 0 &&
      isInitialLoadRef.current &&
      !isLoadingOlder
    ) {
      scrollManager.scrollToBottom("initial_load");
      isInitialLoadRef.current = false;
    }
  }, [chatId, isLoading, messages.length, isLoadingOlder, scrollManager]);

  // ResizeObserver for initial load - handles media loading professionally
  useEffect(() => {
    if (isLoading || !containerRef.current || messages.length === 0) {
      return;
    }

    const container = containerRef.current;
    let resizeTimeout: NodeJS.Timeout;

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Only scroll if within 5 seconds of initial load (enough time for heavy media)
        const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
        if (timeSinceLoad < 5000) {
          const context = scrollManager.getScrollContext();
          if (context.distanceFromBottom < 800) {
            scrollManager.scrollToBottom("initial_load");
          }
        }
      }, 50);
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages.length is intentionally NOT in deps to prevent recreating observer on every message
  }, [chatId, isLoading, scrollManager]);

  // Setup scroll listener
  useEffect(() => {
    return scrollManager.setupScrollListener(containerRef.current);
  }, [chatId, scrollManager]);

  // Typing scroll
  useEffect(() => {
    if (isTyping) {
      scrollManager.scrollToBottom("typing_indicator");
    }
  }, [isTyping, scrollManager]);

  // Chat updated scroll
  const scrollToBottom = useCallback(
    (behavior: "instant" | "smooth" | "auto" = "smooth") => {
      const trigger = behavior === "auto" ? "manual_button" : "chat_updated";
      scrollManager.scrollToBottom(trigger);
    },
    [scrollManager],
  );

  // Auto-scroll on new messages - SIMPLIFIED LOGIC
  useEffect(() => {
    // Skip if no messages or still in initial load phase
    if (messages.length === 0 || isInitialLoadRef.current) {
      return;
    }

    // Skip if loading older messages (prevents jump)
    if (isFetchingNextPage || isLoadingOlder) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // First time seeing messages - initialize ref and skip scroll
    if (!lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      firstMessageIdRef.current = messages[0]?.id ?? null;
      return;
    }

    // Check if this is a NEW message (different from last known ID)
    const isNewMessage = lastMessage.id !== lastMessageIdRef.current;

    // Check if we loaded older messages at the top (first message changed)
    const firstMessage = messages[0];
    const loadedOlderMessages = firstMessage && firstMessage.id !== firstMessageIdRef.current;

    // Only scroll for NEW messages, not when loading older ones
    if (isNewMessage && !loadedOlderMessages) {
      const context = scrollManager.getScrollContext();
      const isOwnMessage = lastMessage.sender === "agent";
      const isSystemMessage = lastMessage.sender === "system";
      const hasMedia = !!(lastMessage.messageType && !["text", "comment"].includes(lastMessage.messageType));

      // Rule 1: Own messages ALWAYS scroll (instant)
      if (isOwnMessage) {
        scrollManager.scrollToBottom("own_message");
      }
      // Rule 2: System messages ALWAYS scroll (smooth)
      else if (isSystemMessage) {
        scrollManager.scrollToBottom("system_message");
      }
      // Rule 3: Received messages - scroll based on distance from bottom
      else {
        // For media, be more aggressive (scroll if < 500px from bottom)
        if (hasMedia && context.distanceFromBottom < 500) {
          scrollManager.scrollToBottom("own_message"); // instant scroll
        } else {
          // For text, use standard threshold (300px)
          scrollManager.scrollToBottom("received_message", {
            ...context,
            isLoadingOlder,
            messageIndex: 0,
            totalMessages: messages.length,
          });
        }
      }

      // Update last message ref
      lastMessageIdRef.current = lastMessage.id;
    }

    // Handle media expansion for SAME message (when media loads/expands)
    else if (!isNewMessage && lastMessage.id === lastMessageIdRef.current) {
      const context = scrollManager.getScrollContext();
      const hasMedia = !!(lastMessage.messageType && !["text", "comment"].includes(lastMessage.messageType));

      // If message has media and we're very close to bottom, keep scrolling as it expands
      if (hasMedia && context.distanceFromBottom < 600) {
        scrollManager.scrollToBottom("own_message");
      }
    }

    // Always update first message ref
    if (firstMessage) {
      firstMessageIdRef.current = firstMessage.id;
    }
  }, [messages, isFetchingNextPage, isLoadingOlder, scrollManager]);

  // Image load callback
  const handleImageLoad = useCallback(
    (index: number) => {
      if (isLoadingOlder) return;

      const context = scrollManager.getScrollContext();
      const isRecent =
        index >= messages.length - SCROLL_CONSTANTS.RECENT_MESSAGE_COUNT;
      const trigger = isRecent ? "image_load_recent" : "image_load_old";

      scrollManager.scrollToBottom(trigger, {
        ...context,
        isLoadingOlder,
        messageIndex: index,
        totalMessages: messages.length,
      });
    },
    [isLoadingOlder, messages.length, scrollManager],
  );

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)} {...props}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2",
              i % 2 === 0 ? "justify-start" : "justify-end",
            )}
          >
            <Skeleton className="h-16 w-64 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative space-y-4", className)}
      {...props}
    >
      {/* Sentinel for infinite scroll */}
      {hasNextPage && <div ref={infiniteScroll.sentinelRef} className="h-px" />}

      {/* Loading indicator */}
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
            prevMessage?.timestamp,
          );
          const shouldHideBadge = index === 0 && isFetchingNextPage;

          return (
            <Fragment key={message.id}>
              {showDateDivider && !shouldHideBadge && (
                <ChatMessageDateDivider date={new Date(message.timestamp)} />
              )}
              {message.messageType === "comment" ? (
                <ChatMessageComment message={message as Message} />
              ) : message.sender === "system" ? (
                <ChatMessageSystem message={message as Message} />
              ) : (
                <ChatMessage
                  message={message as Message}
                  showAvatar={showAvatar}
                  canEditMessages={canEditMessages}
                  canDeleteMessages={canDeleteMessages}
                  onImageLoad={() => handleImageLoad(index)}
                />
              )}
            </Fragment>
          );
        })}

        {/* Typing indicator */}
        {isTyping && <ChatMessageTypingIndicator />}

        {/* Anchor for scroll */}
        <div ref={scrollManager.messagesEndRef} className="h-6" />
      </div>

      {/* Scroll to bottom button */}
      {scrollManager.showScrollButton &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="animate-in fade-in slide-in-from-bottom-2 fixed right-8 bottom-24 z-50">
            <Button
              onClick={() => scrollToBottom("auto")}
              size="icon"
              variant="secondary"
              className="bg-accent hover:bg-accent h-11 w-11 rounded-full shadow-lg transition-shadow hover:shadow-xl"
              aria-label="Ir para mensagens recentes"
            >
              <ChevronDown className="text-foreground/70 h-5 w-5" />
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Typing indicator - WhatsApp style
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
