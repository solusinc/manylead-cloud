"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock, MessageCircle, Star, ChevronDown, ArrowRightLeft } from "lucide-react";

import { cn } from "@manylead/ui";
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
  sender: "contact" | "agent" | "system";
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  messageType?: string;
}

export function ChatMessage({
  message,
  showAvatar: _showAvatar = true,
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
        "max-w-[280px] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl px-4 py-2 relative overflow-hidden",
        isOutgoing
          ? "bg-msg-outgoing rounded-br-sm"
          : "bg-msg-incoming rounded-bl-sm",
        className,
      )}
    >
      {showActions && (
        <div
          className="absolute top-1 right-1 rounded-full p-0.5 transition-all duration-200"
          style={{
            backgroundImage: isOutgoing
              ? 'radial-gradient(circle at 66% 25%, var(--msg-outgoing) 0%, var(--msg-outgoing) 55%, transparent 70%)'
              : 'radial-gradient(circle at 66% 25%, var(--msg-incoming) 0%, var(--msg-incoming) 55%, transparent 70%)'
          }}
        >
          <ChatMessageActions isOutgoing={isOutgoing} onOpenChange={onMenuOpenChange} />
        </div>
      )}
      <ChatMessageContent content={message.content} isOutgoing={isOutgoing} />
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
  isOutgoing,
}: {
  content: string;
  className?: string;
  isOutgoing?: boolean;
}) {
  // Renderizar markdown simples: **texto** -> <strong>texto</strong>
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      }
      return part;
    });
  };

  return (
    <p
      className={cn(
        "break-words text-sm whitespace-pre-wrap overflow-wrap-anywhere",
        isOutgoing && "dark:text-white",
        className
      )}
    >
      {renderContent(content)}
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
            "h-6 w-6 rounded-sm hover:!bg-transparent hover:!text-current focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:!bg-transparent",
            isOutgoing ? "text-foreground/60 dark:text-white/70" : "text-muted-foreground",
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

/**
 * Mensagem de sistema (ex: "Sessão criada", "Transferida de X para Y")
 * Renderizada como badge centralizado na timeline
 */
export function ChatMessageSystem({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex justify-center", className)}>
      <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-muted/50 px-3 py-1.5 text-sm font-semibold shadow-sm">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
