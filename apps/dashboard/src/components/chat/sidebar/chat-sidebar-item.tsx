/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import Image from "next/image";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FaUser, FaWhatsapp } from "react-icons/fa";

import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Badge } from "@manylead/ui/badge";

interface ChatSidebarItemProps {
  chat: {
    id: string;
    contact: {
      name: string;
      avatar: string | null;
    };
    lastMessage: string;
    lastMessageAt: Date;
    unreadCount: number;
    status: "open" | "closed";
    messageSource?: "whatsapp" | "internal";
  };
  isActive?: boolean;
  isTyping?: boolean;
  className?: string;
}

export function ChatSidebarItem({
  chat,
  isActive,
  isTyping = false,
  className,
  ...props
}: ChatSidebarItemProps & React.ComponentProps<"a">) {
  const isClosed = chat.status === "closed";

  return (
    <Link
      href={`/chats/${chat.id}`}
      className={cn(
        "hover:bg-accent/50 flex cursor-pointer items-start gap-3 border-b p-4 transition-colors",
        isActive && "bg-accent",
        isClosed && "grayscale opacity-60",
        className,
      )}
      {...props}
    >
      <ChatSidebarItemAvatar
        name={chat.contact.name}
        avatar={chat.contact.avatar}
        messageSource={chat.messageSource}
      />

      <div className="min-w-0 flex-1">
        <ChatSidebarItemContent
          name={chat.contact.name}
          message={chat.lastMessage}
          timestamp={chat.lastMessageAt}
          unreadCount={chat.unreadCount}
          isTyping={isTyping}
        />
      </div>
    </Link>
  );
}

export function ChatSidebarItemAvatar({
  name,
  avatar,
  messageSource = "whatsapp",
  className,
}: {
  name: string;
  avatar: string | null;
  messageSource?: "whatsapp" | "internal";
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className="h-12 w-12 border">
        {avatar ? (
          <img src={avatar} alt={name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground">
            <FaUser className="h-5 w-5" />
          </AvatarFallback>
        )}
      </Avatar>

      {/* Badge no canto inferior esquerdo */}
      <div className="absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-background">
        {messageSource === "whatsapp" ? (
          <FaWhatsapp className="h-3 w-3 text-green-500" />
        ) : (
          <>
            <Image
              src="/assets/manylead-icon-light.png"
              alt="ManyLead"
              width={12}
              height={12}
              className="dark:hidden"
            />
            <Image
              src="/assets/manylead-icon-dark.png"
              alt="ManyLead"
              width={12}
              height={12}
              className="hidden dark:block"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ChatSidebarItemContent({
  name,
  message,
  timestamp,
  unreadCount,
  isTyping = false,
  className,
}: {
  name: string;
  message: string;
  timestamp: Date;
  unreadCount: number;
  isTyping?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        <ChatSidebarItemTime timestamp={timestamp} />
      </div>

      <div className="flex items-center justify-between gap-2">
        {isTyping ? (
          <TypingIndicator />
        ) : (
          <p className="text-muted-foreground flex-1 truncate text-sm">
            {message}
          </p>
        )}
        {unreadCount > 0 && <ChatSidebarItemBadge count={unreadCount} />}
      </div>
    </div>
  );
}

// Versão antiga (comentada para referência)
// function TypingIndicatorOld() {
//   return (
//     <div className="flex items-center gap-1">
//       <span className="text-primary text-sm font-medium">digitando</span>
//       <div className="flex gap-0.5">
//         <span className="animate-bounce text-primary" style={{ animationDelay: "0ms" }}>.</span>
//         <span className="animate-bounce text-primary" style={{ animationDelay: "150ms" }}>.</span>
//         <span className="animate-bounce text-primary" style={{ animationDelay: "300ms" }}>.</span>
//       </div>
//     </div>
//   );
// }

// Versão com bolinhas (comentada)
// function TypingIndicatorDots() {
//   return (
//     <div className="flex items-center gap-1.5">
//       <div className="flex gap-1">
//         <span
//           className="bg-primary h-1.5 w-1.5 rounded-full animate-bounce"
//           style={{ animationDelay: "0ms", animationDuration: "1s" }}
//         />
//         <span
//           className="bg-primary h-1.5 w-1.5 rounded-full animate-bounce"
//           style={{ animationDelay: "200ms", animationDuration: "1s" }}
//         />
//         <span
//           className="bg-primary h-1.5 w-1.5 rounded-full animate-bounce"
//           style={{ animationDelay: "400ms", animationDuration: "1s" }}
//         />
//       </div>
//       <span className="text-primary text-xs font-medium">digitando</span>
//     </div>
//   );
// }

// Versão WhatsApp - apenas texto em negrito
function TypingIndicator() {
  return (
    <span className="text-primary flex-1 truncate text-sm font-semibold">
      digitando...
    </span>
  );
}

export function ChatSidebarItemTime({
  timestamp,
  className,
}: {
  timestamp: Date;
  className?: string;
}) {
  let formatted: string;

  if (isToday(timestamp)) {
    // Hoje: mostra apenas a hora (ex: "14:30")
    formatted = format(timestamp, "HH:mm");
  } else if (isYesterday(timestamp)) {
    // Ontem: mostra "Ontem"
    formatted = "Ontem";
  } else if (isThisWeek(timestamp, { weekStartsOn: 0 })) {
    // Esta semana: mostra o dia da semana (ex: "Segunda")
    formatted = format(timestamp, "EEEE", { locale: ptBR });
    // Capitaliza a primeira letra
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } else {
    // Mais antigo: mostra a data (ex: "10/01/2025")
    formatted = format(timestamp, "dd/MM/yyyy");
  }

  return (
    <span
      className={cn(
        "text-muted-foreground text-xs whitespace-nowrap",
        className,
      )}
    >
      {formatted}
    </span>
  );
}

export function ChatSidebarItemBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <Badge
      variant="default"
      className={cn("h-5 min-w-5 rounded-full px-1.5 text-[10px]", className)}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
