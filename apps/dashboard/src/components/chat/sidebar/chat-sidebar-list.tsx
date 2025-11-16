"use client";

import { cn } from "@manylead/ui";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChatSidebarItem } from "./chat-sidebar-item";

// Mock data - será substituído depois
const mockChats = [
  {
    id: "1",
    contact: { name: "João Silva", avatar: null },
    lastMessage: "Olá! Gostaria de saber mais sobre o produto",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 2,
    status: "open" as const,
  },
  {
    id: "2",
    contact: { name: "Maria Santos", avatar: null },
    lastMessage: "Obrigado pelo atendimento!",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
    unreadCount: 0,
    status: "open" as const,
  },
  {
    id: "3",
    contact: { name: "Pedro Oliveira", avatar: null },
    lastMessage: "Quando posso receber o produto?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    unreadCount: 1,
    status: "open" as const,
  },
];

export function ChatSidebarList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: mockChats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-y-auto", className)}
      {...props}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chat = mockChats[virtualItem.index];
          if (!chat) return null;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ChatSidebarItem chat={chat} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
