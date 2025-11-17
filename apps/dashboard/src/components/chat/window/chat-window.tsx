"use client";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";

import { ChatInput } from "../input";
import { ChatMessageList } from "../message";
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

  const chat =
    (mockChats[chatId as keyof typeof mockChats] as
      | (typeof mockChats)["1"]
      | undefined) ?? mockChats["1"];

  return (
    <div
      className={cn(
        "flex h-full max-h-[calc(100vh-3.5rem)] flex-col sm:max-h-full",
        "bg-[url('/assets/chat-messages-bg-light.png')] dark:bg-[url('/assets/chat-messages-bg-dark.png')] bg-repeat bg-[length:auto]",
        className,
      )}
      {...props}
    >
      <ChatWindowHeader chat={chat} />

      <ScrollArea className="flex-1 overflow-auto px-6 py-4">
        <ChatMessageList chatId={chatId} />
      </ScrollArea>

      <div className="sticky bottom-0 mb-2 flex h-14 items-center px-4">
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
    <div className={cn("flex h-full flex-col", className)} {...props}>
      {children}
    </div>
  );
}
