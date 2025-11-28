"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { Skeleton } from "@manylead/ui/skeleton";

import { useAccessDeniedModal } from "~/components/providers/access-denied-modal-provider";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { ChatInput } from "../input";
import { ChatMessageList } from "../message";
import { ChatWindowHeader } from "./chat-window-header";
import { ChatReplyProvider } from "../providers/chat-reply-provider";

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
  const session = useServerSession();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasMarkedAsReadRef = useRef(false);
  const isMountedRef = useRef(true);
  const { showAccessDeniedModal } = useAccessDeniedModal();

  // Buscar chat da API
  const { data: chatData, isLoading } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    }),
  );

  // Buscar agent atual
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id }),
  );

  // Encontrar o chat específico
  const chatItem = chatData?.items.find((item) => item.chat.id === chatId);

  // Mutation para marcar chat como lido
  const markAsReadMutation = useMutation(
    trpc.chats.markAsRead.mutationOptions({
      onSuccess: () => {
        // Invalidar query para refetch a lista de chats
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });
      },
    }),
  );

  // Redirect para /chats se conversa não encontrada (após loading)
  useEffect(() => {
    if (!isLoading && !chatItem) {
      router.replace("/chats");
    }
  }, [isLoading, chatItem, router]);

  // Resetar flag quando trocar de chat
  useEffect(() => {
    hasMarkedAsReadRef.current = false;
  }, [chatId]);

  // Controlar estado de montagem do componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Mutation para marcar todas as mensagens como lidas
  const markAllMessagesAsReadMutation = useMutation(
    trpc.messages.markAllAsRead.mutationOptions(),
  );

  // Marcar chat como lido quando abrir (apenas uma vez por chat)
  useEffect(() => {
    if (chatItem && !hasMarkedAsReadRef.current && chatItem.chat.unreadCount > 0) {
      // Verificar se o chat está realmente ativo na URL
      const currentPath = window.location.pathname;
      const isInThisChat = currentPath.includes(`/chats/${chatId}`);

      if (!isInThisChat) {
        return; // Não marcar como lido se não estiver vendo o chat
      }

      hasMarkedAsReadRef.current = true;

      // Marcar o chat como lido (zera unreadCount)
      markAsReadMutation.mutate({
        id: chatItem.chat.id,
        createdAt: chatItem.chat.createdAt,
      });

      // Marcar todas as mensagens do contato como lidas (atualiza ticks)
      markAllMessagesAsReadMutation.mutate({
        chatId: chatItem.chat.id,
      });
    }
  }, [chatItem, markAsReadMutation, markAllMessagesAsReadMutation, chatId]);

  // Marcar como lido automaticamente quando receber mensagem no chat ativo
  useEffect(() => {
    if (!socket.isConnected || !chatItem) return;

    const unsubscribe = socket.onMessageNew((event) => {
      // Verificar se componente ainda está montado
      if (!isMountedRef.current) return;

      // Verificar em tempo real se ainda está no chat (não depender de params que pode estar desatualizado)
      const currentPath = window.location.pathname;
      const isInThisChat = currentPath.includes(`/chats/${chatId}`);

      if (!isInThisChat) return;

      const messageChatId = event.message.chatId as string;
      if (messageChatId === chatId) {
        // Marcar o chat como lido (zera unreadCount)
        markAsReadMutation.mutate({
          id: chatItem.chat.id,
          createdAt: chatItem.chat.createdAt,
        });

        // Marcar todas as mensagens do contato como lidas (atualiza ticks)
        markAllMessagesAsReadMutation.mutate({
          chatId: chatItem.chat.id,
        });
      }
    });

    return unsubscribe;
  }, [socket, socket.isConnected, chatId, chatItem, markAsReadMutation, markAllMessagesAsReadMutation]);

  // Detectar quando o chat é atribuído para outro agent (APENAS para members)
  useEffect(() => {
    if (!socket.isConnected || !chatItem || !currentAgent) return;

    // Owner e Admin podem ver todos os chats, não aplicar restrição
    if (currentAgent.role === "owner" || currentAgent.role === "admin") {
      console.log("[ChatWindow] Owner/Admin - sem restrição de acesso");
      return;
    }

    const unsubscribe = socket.onChatUpdated((event) => {
      const updatedChatId = event.chat.id as string;
      const updatedAssignedTo = event.chat.assignedTo as string | null;

      console.log("[ChatWindow] Chat atualizado:", {
        updatedChatId,
        currentChatId: chatId,
        updatedAssignedTo,
        currentAgentId: currentAgent.id,
        shouldBlock: updatedChatId === chatId && updatedAssignedTo && updatedAssignedTo !== currentAgent.id,
      });

      // Se é o chat atual E foi atribuído para outro agent (member não pode mais ver)
      if (
        updatedChatId === chatId &&
        updatedAssignedTo &&
        updatedAssignedTo !== currentAgent.id
      ) {
        console.log("[ChatWindow] 🚫 Acesso negado - chamando modal global");
        // Mostrar modal global e redirecionar
        showAccessDeniedModal();
      }
    });

    return unsubscribe;
  }, [socket, socket.isConnected, chatId, chatItem, currentAgent, router, showAccessDeniedModal]);

  // Loading skeleton
  if (isLoading || !chatItem) {
    return (
      <div
        className={cn(
          "flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
          "bg-auto] bg-[url('/assets/chat-messages-bg-light.png')] bg-repeat dark:bg-[url('/assets/chat-messages-bg-dark.png')]",
          className,
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
                className={cn(
                  "flex gap-2",
                  i % 2 === 0 ? "justify-start" : "justify-end"
                )}
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
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <ChatReplyProvider
      contactName={chat.contact.customName ?? chat.contact.name}
      messageSource={chat.source}
      instanceCode={chat.contact.instanceCode}
      organizationName={chat.contact.name}
    >
      <ScrollToBottomContext.Provider value={scrollToBottom}>
        <div
          className={cn(
            "flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
            "bg-auto] bg-[url('/assets/chat-messages-bg-light.png')] bg-repeat dark:bg-[url('/assets/chat-messages-bg-dark.png')]",
            className,
          )}
          {...props}
        >
          <ChatWindowHeader chat={chat} />

          <ScrollArea
            ref={scrollAreaRef}
            className="flex-1 overflow-auto px-6 py-0"
          >
            <ChatMessageList chatId={chatId} />
          </ScrollArea>

          {/* Input bar - WhatsApp style: empurra mensagens para cima ao invés de ficar sticky */}
          <div className={cn("min-h-14 items-center bg-background", chat.status === "open" && "px-4 py-4")}>
            <ChatInput
              chatId={chatId}
              chatCreatedAt={chatItem.chat.createdAt}
              chatStatus={chat.status}
              assignedTo={chat.assignedTo}
              onTypingStart={() => socket.emitTypingStart(chatId)}
              onTypingStop={() => socket.emitTypingStop(chatId)}
            />
          </div>
        </div>
      </ScrollToBottomContext.Provider>
    </ChatReplyProvider>
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
