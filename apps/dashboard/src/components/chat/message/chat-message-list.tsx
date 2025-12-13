"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isSameDay } from "date-fns";
import { ChevronDown, Loader2, Mic } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Skeleton } from "@manylead/ui/skeleton";

import type { Message } from "./chat-message";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useChatReply } from "../providers/chat-reply-provider";
import { useChat } from "../providers/chat-context";
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
  hideScrollButton = false,
  className,
  ...props
}: {
  chatId: string;
  hideScrollButton?: boolean;
} & React.ComponentProps<"div">) {
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const { replyingTo } = useChatReply();
  const { chat } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // Track refs for auto-scroll logic
  const lastMessageIdRef = useRef<string | null>(null);
  const firstMessageIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // 1. Data Layer
  const {
    messages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessageData(chatId);

  // 2. Scroll Layer
  const {
    messagesEndRef,
    scrollViewportRef,
    showScrollButton,
    scrollToBottom: scrollToBottomFn,
    getScrollContext,
    setupScrollListener,
  } = useScrollManager();

  // 3. Infinite Scroll Layer
  const { sentinelRef } = useInfiniteScroll(scrollViewportRef, {
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
  const { isTyping, isRecording } = useMessageSocket(socket, chatId);

  // 5. Focus Layer
  useMessageFocus(chatId);

  // 6. Permissions
  const { data: currentAgent } = useQuery(
    trpc.agents.getCurrent.queryOptions(),
  );

  const canEditMessages = currentAgent?.permissions.messages.canEdit ?? false;
  const canDeleteMessages = currentAgent?.permissions.messages.canDelete ?? false;

  // Reset initial load flag when chat changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    lastMessageIdRef.current = null;
    firstMessageIdRef.current = null;
  }, [chatId]);

  // Initial scroll to bottom - SIMPLE
  useEffect(() => {
    if (
      !isLoading &&
      messages.length > 0 &&
      isInitialLoadRef.current &&
      !isLoadingOlder
    ) {
      scrollToBottomFn("initial_load");

      // Keep flag true for 2 seconds to prevent auto-scroll during image loading
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 2000);
    }
  }, [chatId, isLoading, messages.length, isLoadingOlder, scrollToBottomFn]);


  // Setup scroll listener
  useEffect(() => {
    return setupScrollListener(containerRef.current);
  }, [chatId, setupScrollListener]);

  // Typing scroll - ONLY if user is near bottom (WhatsApp behavior)
  useEffect(() => {
    if (isTyping) {
      const context = getScrollContext();
      // Only scroll if user is near bottom (< 300px)
      if (context.distanceFromBottom < 300) {
        scrollToBottomFn("typing_indicator");
      }
    }
  }, [isTyping, getScrollContext, scrollToBottomFn]);

  // Recording scroll - ONLY if user is near bottom (WhatsApp behavior)
  useEffect(() => {
    if (isRecording) {
      const context = getScrollContext();
      // Only scroll if user is near bottom (< 300px)
      if (context.distanceFromBottom < 300) {
        scrollToBottomFn("recording_indicator");
      }
    }
  }, [isRecording, getScrollContext, scrollToBottomFn]);

  // Chat updated scroll
  const scrollToBottom = useCallback(
    (behavior: "instant" | "smooth" | "auto" = "smooth") => {
      const trigger = behavior === "auto" ? "manual_button" : "chat_updated";
      scrollToBottomFn(trigger);
    },
    [scrollToBottomFn],
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
      const context = getScrollContext();
      const isOwnMessage = lastMessage.isOwnMessage === true;
      const isSystemMessage = lastMessage.sender === "system";
      const hasMedia = !!(lastMessage.messageType && !["text", "comment"].includes(lastMessage.messageType));

      // Rule 1: Own messages ALWAYS scroll (instant)
      if (isOwnMessage) {
        scrollToBottomFn("own_message");
      }
      // Rule 2: System messages ALWAYS scroll (smooth)
      else if (isSystemMessage) {
        scrollToBottomFn("system_message");
      }
      // Rule 3: Received messages - scroll based on distance from bottom
      else {
        // For media, be more aggressive (scroll if < 500px from bottom)
        if (hasMedia && context.distanceFromBottom < 500) {
          scrollToBottomFn("own_message"); // instant scroll
        } else {
          // For text, use standard threshold (300px)
          scrollToBottomFn("received_message", {
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

    // Always update first message ref
    if (firstMessage) {
      firstMessageIdRef.current = firstMessage.id;
    }
  }, [messages, isFetchingNextPage, isLoadingOlder, getScrollContext, scrollToBottomFn]);

  // Image load callback - DISABLED (images have fixed dimensions now)
  const handleImageLoad = useCallback(
    (_index: number) => {
      // No-op - images have fixed dimensions, no need to scroll on load
    },
    [],
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
      {hasNextPage && <div ref={sentinelRef} className="h-px" />}

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
                // Mensagens de welcome/closing/rating devem aparecer como bubbles normais (outgoing)
                (() => {
                  const metadata = message.metadata as { systemEventType?: string } | null;
                  const bubbleSystemTypes = ["welcome_message", "closing_message", "rating_request", "rating_thanks", "out_of_hours_message"];
                  const shouldRenderAsBubble = metadata?.systemEventType && bubbleSystemTypes.includes(metadata.systemEventType);

                  if (shouldRenderAsBubble) {
                    // Renderizar como mensagem outgoing (do agente)
                    return (
                      <ChatMessage
                        message={{
                          ...message,
                          sender: "agent", // Forçar como agent para aparecer como outgoing
                        } as Message}
                        showAvatar={showAvatar}
                        canEditMessages={false}
                        canDeleteMessages={false}
                        onImageLoad={() => handleImageLoad(index)}
                      />
                    );
                  }
                  return <ChatMessageSystem message={message as Message} />;
                })()
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

        {/* Recording indicator (prioridade sobre typing) - apenas cross-org */}
        {isRecording && chat.source === "internal" && <ChatMessageRecordingIndicator />}

        {/* Typing indicator - apenas cross-org */}
        {!isRecording && isTyping && chat.source === "internal" && <ChatMessageTypingIndicator />}

        {/* Anchor for scroll */}
        <div ref={messagesEndRef} className="h-6" />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton &&
        !hideScrollButton &&
        !replyingTo &&
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

function ChatMessageRecordingIndicator() {
  return (
    <div className="mb-2 flex justify-start gap-2">
      <div className="bg-msg-incoming max-w-[65%] rounded-2xl rounded-bl-sm px-3 py-2.5">
        <Mic
          className="h-5 w-5 opacity-70"
          style={{
            animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      </div>
    </div>
  );
}
