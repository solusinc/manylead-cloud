"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock, MessageCircle, Star, ChevronDown } from "lucide-react";

import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";

interface Message {
  id: string;
  content: string;
  sender: "contact" | "agent";
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
}

export function ChatMessage({
  message,
  showAvatar = true,
  className,
  ...props
}: {
  message: Message;
  showAvatar?: boolean;
} & React.ComponentProps<"div">) {
  const isOutgoing = message.sender === "agent";
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "mb-2 flex gap-2 group relative",
        isOutgoing ? "justify-end" : "justify-start",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {!isOutgoing && showAvatar && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">JO</AvatarFallback>
        </Avatar>
      )}

      <ChatMessageBubble
        message={message}
        isOutgoing={isOutgoing}
        showActions={isHovered || isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
      />
    </div>
  );
}

export function ChatMessageBubble({
  message,
  isOutgoing,
  showActions = false,
  onMenuOpenChange,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  showActions?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[65%] rounded-2xl px-4 py-2 relative",
        isOutgoing
          ? "bg-msg rounded-br-sm"
          : "bg-muted rounded-bl-sm",
        className,
      )}
    >
      {showActions && (
        <div
          className="absolute top-1 right-1 rounded-full p-0.5 transition-all duration-200"
          style={{
            backgroundImage: isOutgoing
              ? 'radial-gradient(circle at 66% 25%, var(--msg) 0%, var(--msg) 55%, transparent 70%)'
              : 'radial-gradient(circle at 66% 25%, oklch(0.97 0 0) 0%, oklch(0.97 0 0) 55%, transparent 70%)'
          }}
        >
          <ChatMessageActions isOutgoing={isOutgoing} onOpenChange={onMenuOpenChange} />
        </div>
      )}
      <ChatMessageContent content={message.content} />
      <ChatMessageFooter
        timestamp={message.timestamp}
        status={message.status}
        isOutgoing={isOutgoing}
      />
    </div>
  );
}

export function ChatMessageContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <p
      className={cn("wrap-break-words text-sm whitespace-pre-wrap", className)}
    >
      {content}
    </p>
  );
}

export function ChatMessageFooter({
  timestamp,
  status,
  isOutgoing,
  className,
}: {
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  isOutgoing: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-1 flex items-center justify-end gap-1", className)}>
      <ChatMessageTime timestamp={timestamp} />
      {isOutgoing && status && <ChatMessageStatus status={status} />}
    </div>
  );
}

export function ChatMessageTime({
  timestamp,
  className,
}: {
  timestamp: Date;
  className?: string;
}) {
  return (
    <span className={cn("text-xs opacity-70", className)}>
      {format(timestamp, "HH:mm")}
    </span>
  );
}

export function ChatMessageStatus({
  status,
  className,
}: {
  status: "pending" | "sent" | "delivered" | "read";
  className?: string;
}) {
  const iconClass = cn("h-3 w-3", className);

  switch (status) {
    case "pending":
      return <Clock className={cn(iconClass, "text-muted-foreground")} />;
    case "sent":
      return <Check className={cn(iconClass, "opacity-70")} />;
    case "delivered":
      return <CheckCheck className={cn(iconClass, "opacity-70")} />;
    case "read":
      return <CheckCheck className={cn(iconClass, "text-blue-500")} />;
    default:
      return null;
  }
}

export function ChatMessageActions({
  isOutgoing,
  onOpenChange,
  className,
}: {
  isOutgoing: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-sm hover:bg-transparent text-muted-foreground",
            className
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-sm">
        <DropdownMenuItem className="gap-3 cursor-pointer">
          <MessageCircle className="h-4 w-4" />
          <span>Responder</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-3 cursor-pointer">
          <Star className="h-4 w-4" />
          <span>Favoritar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
