"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { Skeleton } from "@manylead/ui/skeleton";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useTRPC } from "~/lib/trpc/react";
import { ChatInput } from "../input";
import { ChatMessageList } from "../message";
import { ChatWindowHeader } from "./chat-window-header";
import { ChatReplyProvider, useChatReply } from "../providers/chat-reply-provider";
import { ChatErrorBoundary } from "../providers/chat-error-boundary";
import { ChatProvider } from "../providers/chat-context";
import { MediaPreviewDialog } from "../input/media-preview";
import { useSendMedia } from "../input/hooks/use-send-media";
import { ChatImagesProvider } from "../message/chat-images-context";

// Context for scroll to bottom function
const ScrollToBottomContext = createContext<(() => void) | null>(null);
export const useScrollToBottom = () => useContext(ScrollToBottomContext);

export function ChatWindow({
  chatId,
  className,
  ...props
}: { chatId: string } & React.ComponentProps<"div">) {
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const router = useRouter();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Buscar chat da API
  const { data: chatData, isLoading } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  // Encontrar o chat específico
  const chatItem = chatData?.items.find((item) => item.chat.id === chatId);

  // Redirect para /chats se conversa não encontrada (após loading)
  useEffect(() => {
    if (!isLoading && !chatItem) {
      router.replace("/chats");
    }
  }, [isLoading, chatItem, router]);

  // Loading skeleton
  if (isLoading || !chatItem) {
    return (
      <div
        className={cn(
          "flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
          "bg-auto] bg-[url('/assets/chat-messages-bg-light.png')] bg-repeat dark:bg-[url('/assets/chat-messages-bg-dark.png')]",
          className
        )}
        {...props}
      >
        {/* Header skeleton */}
        <div className="bg-background flex h-14 shrink-0 items-center gap-4 border-b px-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Messages skeleton */}
        <ScrollArea className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn("flex gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}
              >
                <Skeleton className="h-16 w-64 rounded-2xl" />
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input skeleton */}
        <div className="mb-2 flex min-h-14 items-center px-4">
          <Skeleton className="h-11 w-full rounded-full" />
        </div>
      </div>
    );
  }

  const chat = {
    id: chatItem.chat.id,
    createdAt: chatItem.chat.createdAt,
    contact: {
      id: chatItem.contact?.id ?? "",
      name: chatItem.contact?.name ?? "Sem nome",
      phoneNumber: chatItem.contact?.phoneNumber ?? "",
      avatar: chatItem.contact?.avatar ?? null,
      instanceCode: chatItem.contact?.metadata?.targetOrganizationInstanceCode,
      customName: chatItem.contact?.customName,
      notes: chatItem.contact?.notes,
      customFields: chatItem.contact?.customFields,
    },
    status: chatItem.chat.status as "open" | "closed",
    assignedTo: chatItem.chat.assignedTo,
    source: chatItem.chat.messageSource as "whatsapp" | "internal",
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <ChatErrorBoundary>
      <ChatProvider chatId={chatId}>
        <ChatReplyProvider
          contactName={chat.contact.customName ?? chat.contact.name}
          messageSource={chat.source}
        >
          <ScrollToBottomContext.Provider value={scrollToBottom}>
            <ChatWindowContent
              chat={chat}
              chatItem={chatItem}
              chatId={chatId}
              scrollAreaRef={scrollAreaRef}
              socket={socket}
              className={className}
              {...props}
            />
          </ScrollToBottomContext.Provider>
        </ChatReplyProvider>
      </ChatProvider>
    </ChatErrorBoundary>
  );
}

function ChatWindowContent({
  chat,
  chatItem,
  chatId,
  scrollAreaRef,
  socket,
  className,
  ...props
}: {
  chat: {
    id: string;
    createdAt: Date;
    contact: {
      id: string;
      name: string;
      phoneNumber: string;
      avatar: string | null;
      instanceCode?: string;
      customName?: string | null;
      notes?: string | null;
      customFields?: Record<string, string> | null;
    };
    status: "open" | "closed";
    assignedTo: string | null;
    source: "whatsapp" | "internal";
  };
  chatItem: {
    chat: {
      id: string;
      createdAt: Date;
      status: string;
      assignedTo: string | null;
      messageSource: string;
    };
  };
  chatId: string;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  socket: ReturnType<typeof useChatSocketContext>;
  className?: string;
} & React.ComponentProps<"div">) {
  const { mediaPreview, replyingTo, cancelReply, cancelMediaPreview } = useChatReply();
  const { sendMedia, isUploading, uploadProgress } = useSendMedia(chatId, replyingTo);

  const handleMediaSend = useCallback(
    async (caption: string) => {
      if (!mediaPreview) return;

      try {
        await sendMedia({
          chatId,
          file: mediaPreview,
          caption: caption || undefined,
          // Reply-to metadata is now handled by useSendMedia hook
        });
        cancelMediaPreview();
        cancelReply();
      } catch (error) {
        console.error("Failed to send media:", error);
      }
    },
    [mediaPreview, sendMedia, chatId, cancelMediaPreview, cancelReply]
  );

  // Send "available" (online) presence when chat is opened
  // Send "unavailable" (offline) when chat is closed
  // ONLY for WhatsApp chats (cross-org will have dedicated presence table later)
  useEffect(() => {
    // Só enviar presence para chats WhatsApp
    if (chat.source !== "whatsapp") {
      return;
    }

    // Enviar "available" ao abrir o chat
    socket.emitPresenceAvailable(chatId);

    // Cleanup: enviar "unavailable" ao fechar/sair do chat
    return () => {
      socket.emitPresenceUnavailable(chatId);
    };
  }, [chatId, socket, chat.source]);

  return (
    <div
      className={cn(
        "relative flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
        "bg-auto] bg-[url('/assets/chat-messages-bg-light.png')] bg-repeat dark:bg-[url('/assets/chat-messages-bg-dark.png')]",
        className
      )}
      {...props}
    >
      {/* Media Preview Dialog */}
      {mediaPreview && (
        <MediaPreviewDialog
          file={mediaPreview}
          onSend={handleMediaSend}
          onClose={cancelMediaPreview}
          isLoading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}

      <ChatWindowHeader chat={chat} />

      <ChatImagesProvider>
        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-auto px-6 py-0">
          <ChatMessageList chatId={chatId} hideScrollButton={!!mediaPreview} />
        </ScrollArea>
      </ChatImagesProvider>

      {/* Input bar - WhatsApp style */}
      <div
        className={cn(
          "min-h-14 items-center bg-background",
          chat.status === "open" && !mediaPreview && "px-4 py-4"
        )}
      >
        <ChatInput
          chatId={chatId}
          chatCreatedAt={chatItem.chat.createdAt}
          chatStatus={chat.status}
          assignedTo={chat.assignedTo}
          onTypingStart={() => socket.emitTypingStart(chatId)}
          onTypingStop={() => socket.emitTypingStop(chatId)}
          onRecordingStart={() => socket.emitRecordingStart(chatId)}
          onRecordingStop={() => socket.emitRecordingStop(chatId)}
        />
      </div>
    </div>
  );
}

export function ChatWindowContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex h-full flex-col", className)} {...props}>
      {children}
    </div>
  );
}
