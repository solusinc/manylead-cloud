"use client";

import type React from "react";
import { useState } from "react";

import { cn } from "@manylead/ui";

import { ChatMessageBubble } from "./chat-message-content";

export interface Message {
  id: string;
  content: string;
  sender: "contact" | "agent" | "system";
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  messageType?: string;
  isStarred?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  editedAt?: Date | null;
  readAt?: Date | null;
  repliedToMessageId?: string | null;
  metadata?: Record<string, unknown>;
  chatId?: string;
}

export function ChatMessage({
  message,
  showAvatar: _showAvatar = true,
  canEditMessages = false,
  canDeleteMessages = false,
  className,
  ...props
}: {
  message: Message;
  showAvatar?: boolean;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
} & React.ComponentProps<"div">) {
  const isOutgoing = message.sender === "agent";
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group relative mb-2 flex scroll-mt-20 gap-2",
        isOutgoing ? "justify-end" : "justify-start",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <ChatMessageBubble
        message={message}
        isOutgoing={isOutgoing}
        showActions={isHovered || isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
        canEditMessages={canEditMessages}
        canDeleteMessages={canDeleteMessages}
      />
    </div>
  );
}
