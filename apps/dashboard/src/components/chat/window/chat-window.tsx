"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, createContext, useContext } from "react";
import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";

import { ChatInput } from "../input";
import { ChatMessageList } from "../message";
import { ChatWindowHeader } from "./chat-window-header";
import { useTRPC } from "~/lib/trpc/react";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";

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

  // Se ainda não tiver dados (edge case), não renderiza nada
  if (!chatItem) {
    return null;
  }

  const chat = {
    id: chatItem.chat.id,
    contact: {
      name: chatItem.contact?.name ?? "Sem nome",
      phoneNumber: chatItem.contact?.phoneNumber ?? "",
      avatar: chatItem.contact?.avatar ?? null,
    },
    status: chatItem.chat.status as "open" | "closed",
    assignedTo: chatItem.chat.assignedTo,
    source: chatItem.chat.messageSource as "whatsapp" | "internal",
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  };

  return (
    <ScrollToBottomContext.Provider value={scrollToBottom}>
      <div
        className={cn(
          "flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
          "bg-[url('/assets/chat-messages-bg-light.png')] dark:bg-[url('/assets/chat-messages-bg-dark.png')] bg-repeat bg-[length:auto]",
          className,
        )}
        {...props}
      >
        <ChatWindowHeader chat={chat} />

        <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-auto px-6 py-4">
          <ChatMessageList chatId={chatId} />
        </ScrollArea>

        {/* Input bar - WhatsApp style: empurra mensagens para cima ao invés de ficar sticky */}
        <div className="mb-2 flex min-h-14 items-center px-4">
          <ChatInput
            chatId={chatId}
            onTypingStart={() => socket.emitTypingStart(chatId)}
            onTypingStop={() => socket.emitTypingStop(chatId)}
          />
        </div>
      </div>
    </ScrollToBottomContext.Provider>
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
