"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";
import { useChatAccessControl } from "../window/hooks/use-chat-access-control";

/**
 * Chat data structure
 */
export interface Chat {
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
}

/**
 * Chat context value with all shared data and functions
 */
interface ChatContextValue {
  // Chat data
  chat: Chat;
  chatId: string;
  isLoading: boolean;

  // Current agent info
  currentAgent: {
    id: string;
    name: string;
    role: string;
  } | null;

  // Access control
  isAssignedToMe: boolean;
  isPending: boolean;
  isClosed: boolean;
  canEdit: boolean;

  // Socket functions
  emitTypingStart: () => void;
  emitTypingStop: () => void;

  // Scroll functions
  scrollToBottom: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Hook to access chat context
 * @throws Error if used outside ChatProvider
 */
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}

/**
 * ChatProvider - Provides chat data and functions to all child components
 * Eliminates prop drilling by centralizing chat state
 *
 * @example
 * ```tsx
 * <ChatProvider chatId={chatId}>
 *   <ChatWindowHeader />
 *   <ChatMessageList />
 *   <ChatInput />
 * </ChatProvider>
 * ```
 */
export function ChatProvider({
  chatId,
  children,
}: {
  chatId: string;
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const router = useRouter();
  const session = useServerSession();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch current agent
  const { data: currentAgent } = useCurrentAgent();

  // Fetch chat data
  const { data: chatData, isLoading } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  // Find specific chat
  const chatItem = chatData?.items.find((item) => item.chat.id === chatId);

  // Access control and auto-read marking
  useChatAccessControl(chatId, chatItem);

  // Transform chat data
  const chat = useMemo<Chat | null>(() => {
    if (!chatItem) return null;

    return {
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
  }, [chatItem]);

  // Access control flags
  const isAssignedToMe = useMemo(
    () => chat?.assignedTo === currentAgent?.id,
    [chat?.assignedTo, currentAgent?.id]
  );

  const isPending = useMemo(() => chat?.assignedTo === null, [chat?.assignedTo]);

  const isClosed = useMemo(() => chat?.status === "closed", [chat?.status]);

  const canEdit = useMemo(() => {
    if (!currentAgent) return false;
    const isOwnerOrAdmin = currentAgent.role === "owner" || currentAgent.role === "admin";
    return (isOwnerOrAdmin && isPending) || isAssignedToMe;
  }, [currentAgent, isPending, isAssignedToMe]);

  // Socket functions
  const emitTypingStart = useCallback(() => {
    socket.emitTypingStart(chatId);
  }, [socket, chatId]);

  const emitTypingStop = useCallback(() => {
    socket.emitTypingStop(chatId);
  }, [socket, chatId]);

  // Scroll functions
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, []);

  // Redirect if chat not found (after loading)
  if (!isLoading && !chat) {
    router.replace("/chats");
    return null;
  }

  // Don't render until we have chat data
  if (!chat) {
    return null;
  }

  const value: ChatContextValue = {
    chat,
    chatId,
    isLoading,
    currentAgent: currentAgent
      ? {
          id: currentAgent.id,
          name: session.user.name,
          role: currentAgent.role,
        }
      : null,
    isAssignedToMe,
    isPending,
    isClosed,
    canEdit,
    emitTypingStart,
    emitTypingStop,
    scrollToBottom,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Hook to access scroll area ref (for external components that need direct access)
 */
export function useChatScrollArea() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  return scrollAreaRef;
}
