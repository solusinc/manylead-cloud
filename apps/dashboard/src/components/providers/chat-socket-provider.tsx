"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { UseChatSocketReturn } from "~/hooks/use-chat-socket";
import { useChatSocket } from "~/hooks/use-chat-socket";

const ChatSocketContext = createContext<UseChatSocketReturn | null>(null);

export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const socket = useChatSocket();

  return (
    <ChatSocketContext.Provider value={socket}>
      {children}
    </ChatSocketContext.Provider>
  );
}

export function useChatSocketContext(): UseChatSocketReturn {
  const context = useContext(ChatSocketContext);

  if (!context) {
    throw new Error("useChatSocketContext must be used within ChatSocketProvider");
  }

  return context;
}
