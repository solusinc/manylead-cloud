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
  const chat = {
    id: chatId,
    contact: {
      name: "João Silva",
      phoneNumber: "+5511999999999",
      avatar: null as string | null,
    },
    status: "open" as const,
    assignedTo: null,
  };

  return (
    <div
      className={cn("flex flex-col h-full bg-muted/20", className)}
      {...props}
    >
      <ChatWindowHeader chat={chat} />

      <ScrollArea className="flex-1 px-6 py-4">
        <ChatMessageList chatId={chatId} />
      </ScrollArea>

      <div className="border-t bg-background p-4">
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
