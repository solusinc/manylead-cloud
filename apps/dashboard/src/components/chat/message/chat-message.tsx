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
 * Suporta multi-linha para mensagens de fechamento com layout em 2 colunas (lg/md)
 */
export function ChatMessageSystem({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  // Detectar se é mensagem de fechamento (tem quebras de linha)
  const isClosedMessage = message.content.includes("\n");

  // Se for mensagem de fechamento, parsear os campos
  if (isClosedMessage) {
    const lines = message.content.split("\n");
    const fields = lines.reduce((acc, line) => {
      const [key, ...valueParts] = line.split(": ");
      if (key && valueParts.length > 0) {
        acc[key.trim()] = valueParts.join(": ").trim();
      }
      return acc;
    }, {} as Record<string, string>);

    return (
      <div className={cn("mb-4 flex justify-center", className)}>
        <div className="rounded-lg bg-white dark:bg-muted/50 px-4 py-3 text-sm shadow-sm max-w-2xl w-full">
          {/* Layout em 2 colunas em md/lg */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {/* Coluna 1 */}
            <div className="space-y-2">
              {fields.Protocolo && (
                <div>
                  <span className="text-muted-foreground">Protocolo:</span>{" "}
                  <span className="font-semibold break-all">{fields.Protocolo}</span>
                </div>
              )}
              {fields.Usuário && (
                <div>
                  <span className="text-muted-foreground">Usuário:</span>{" "}
                  <span className="font-semibold">{fields.Usuário}</span>
                </div>
              )}
              {fields.Departamento !== undefined && (
                <div>
                  <span className="text-muted-foreground">Departamento:</span>{" "}
                  <span className="font-semibold">{fields.Departamento || "-"}</span>
                </div>
              )}
            </div>

            {/* Coluna 2 */}
            <div className="space-y-2">
              {fields["Iniciado em"] && (
                <div>
                  <span className="text-muted-foreground">Iniciado em:</span>{" "}
                  <span className="font-semibold">{fields["Iniciado em"]}</span>
                </div>
              )}
              {fields["Atendido em"] && (
                <div>
                  <span className="text-muted-foreground">Atendido em:</span>{" "}
                  <span className="font-semibold">{fields["Atendido em"]}</span>
                </div>
              )}
              {fields["Finalizado em"] && (
                <div>
                  <span className="text-muted-foreground">Finalizado em:</span>{" "}
                  <span className="font-semibold">{fields["Finalizado em"]}</span>
                </div>
              )}
              {fields.Duração && (
                <div>
                  <span className="text-muted-foreground">Duração:</span>{" "}
                  <span className="font-semibold">{fields.Duração}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mensagens simples (Sessão criada, Transferida, etc.)
  return (
    <div className={cn("mb-4 flex justify-center", className)}>
      <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-muted/50 px-3 py-1.5 text-sm font-semibold shadow-sm">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
