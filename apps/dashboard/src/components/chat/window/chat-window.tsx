"use client";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { ChatMessageList } from "../message";
import { ChatInput } from "../input";
import { ChatWindowHeader } from "./chat-window-header";

export function ChatWindow({
  chatId,
  className,
  ...props
}: { chatId: string } & React.ComponentProps<"div">) {
  // TODO: Fetch chat data from tRPC using chatId
  const mockChats = {
    "1": {
      id: "1",
      contact: {
        name: "João Silva",
        phoneNumber: "+5511999999999",
        avatar: null as string | null,
      },
      status: "open" as const,
      assignedTo: null,
      source: "whatsapp" as const,
    },
    "2": {
      id: "2",
      contact: {
        name: "Maria Santos",
        phoneNumber: "+5521988887777",
        avatar: null as string | null,
      },
      status: "closed" as const,
      assignedTo: "user-123",
      source: "internal" as const,
    },
    "3": {
      id: "3",
      contact: {
        name: "Carlos Oliveira",
        phoneNumber: "+5531977776666",
        avatar: null as string | null,
      },
      status: "open" as const,
      assignedTo: null,
      source: "whatsapp" as const,
    },
  };

  const chat = (mockChats[chatId as keyof typeof mockChats] as typeof mockChats["1"] | undefined) ?? mockChats["1"];

  return (
    <div
      className={cn("flex flex-col bg-muted/20 h-full max-h-[calc(100vh-3.5rem)] sm:max-h-full", className)}
      {...props}
    >
      <ChatWindowHeader chat={chat} />

      <ScrollArea className="flex-1 px-6 py-4 overflow-auto">
        <ChatMessageList chatId={chatId} />
      </ScrollArea>

      <div className="bg-background h-14 flex items-center px-4 sticky bottom-0">
        <ChatInput chatId={chatId} />
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
    <div className={cn("flex flex-col h-full", className)} {...props}>
      {children}
    </div>
  );
}
