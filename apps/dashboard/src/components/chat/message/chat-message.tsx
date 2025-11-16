"use client";

import { format } from "date-fns";
import { Check, CheckCheck, Clock } from "lucide-react";

import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";

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

  return (
    <div
      className={cn(
        "mb-2 flex gap-2",
        isOutgoing ? "justify-end" : "justify-start",
        className,
      )}
      {...props}
    >
      {!isOutgoing && showAvatar && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">JO</AvatarFallback>
        </Avatar>
      )}

      <ChatMessageBubble message={message} isOutgoing={isOutgoing} />
    </div>
  );
}

export function ChatMessageBubble({
  message,
  isOutgoing,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[65%] rounded-2xl px-4 py-2",
        isOutgoing
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-muted rounded-bl-sm",
        className,
      )}
    >
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
