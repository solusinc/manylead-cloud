"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@manylead/ui";

import { ChatSocketProvider, useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useServerSession } from "~/components/providers/session-provider";
import { ChatSidebar } from "./sidebar";
import { ChatWindowEmpty } from "./window";

export function ChatLayout({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { hasChatSelected?: boolean }) {
  return (
    <ChatSocketProvider>
      <ChatLayoutInner hasChatSelected={hasChatSelected} className={className} {...props}>
        {children}
      </ChatLayoutInner>
    </ChatSocketProvider>
  );
}

function ChatLayoutInner({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { hasChatSelected?: boolean }) {
  const queryClient = useQueryClient();
  const session = useServerSession();
  const socket = useChatSocketContext();

  // Conectar ao Socket.io quando o layout montar
  useEffect(() => {
    const organizationId = session.session.activeOrganizationId;
    if (organizationId) {
      void socket.connect(organizationId);
    }

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.session.activeOrganizationId]);

  // Escutar eventos de chat
  useEffect(() => {
    if (!socket.isConnected) return;

    // Quando um novo chat é criado ou uma nova mensagem chega
    const unsubscribeNewMessage = socket.onMessageNew(() => {
      // Invalidar queries para atualizar lista de chats e mensagens
      void queryClient.invalidateQueries({ queryKey: [["chats"]] });
      void queryClient.invalidateQueries({ queryKey: [["messages"]] });
    });

    const unsubscribeChatCreated = socket.onChatCreated(() => {
      // Invalidar lista de chats
      void queryClient.invalidateQueries({ queryKey: [["chats"]] });
    });

    const unsubscribeChatUpdated = socket.onChatUpdated(() => {
      // Invalidar lista de chats
      void queryClient.invalidateQueries({ queryKey: [["chats"]] });
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeChatCreated();
      unsubscribeChatUpdated();
    };
  }, [socket, socket.isConnected, queryClient]);

  return (
    <div className={cn("flex h-full overflow-hidden", className)} {...props}>
      <ChatLayoutSidebar hasChatSelected={hasChatSelected} />
      <ChatLayoutMain hasChatSelected={hasChatSelected}>
        {children ?? <ChatWindowEmpty />}
      </ChatLayoutMain>
    </div>
  );
}

export function ChatLayoutSidebar({
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"aside"> & { hasChatSelected?: boolean }) {
  return (
    <aside
      className={cn(
        "bg-background w-full shrink-0 border-r md:w-[445px] flex",
        hasChatSelected && "hidden md:flex", // Hide on mobile when chat is selected
        className,
      )}
      {...props}
    >
      <ChatSidebar />
    </aside>
  );
}

export function ChatLayoutMain({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"main"> & { hasChatSelected?: boolean }) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col overflow-hidden",
        !hasChatSelected && "hidden md:flex", // Hide on mobile when no chat selected
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
