"use client";

import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, User, X, Star, Check, CheckCheck, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Attachment } from "@manylead/db";

import { cn } from "@manylead/ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Button } from "@manylead/ui/button";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageFocusStore } from "~/stores/use-message-focus-store";
import { ChatMessageAttachment } from "../message/chat-message-content";

/**
 * Formata timestamp no estilo WhatsApp (para footer de mensagens)
 */
function formatMessageTimestamp(date: Date): string {
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Ontem";
  }
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    return format(date, "EEEE", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

interface ChatStarredSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

export function ChatStarredSheet({
  open,
  onOpenChange,
  chatId,
}: ChatStarredSheetProps) {
  const trpc = useTRPC();
  const setFocusMessage = useMessageFocusStore((state) => state.setFocusMessage);

  // Buscar mensagens favoritas
  const { data: starredData, isLoading } = useQuery({
    ...trpc.messages.listStarred.queryOptions({
      chatId,
      limit: 50,
    }),
    enabled: open,
  });

  const handleResultClick = (messageId: string) => {
    // Setar mensagem a ser focada (o chat-message-list vai reagir)
    setFocusMessage(chatId, messageId);
    // Fechar o sheet
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <SheetTitle className="text-base font-semibold">
            Mensagens favoritas
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-9 w-9"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Carregando...
            </p>
          ) : starredData?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mensagem favorita
            </p>
          ) : (
            <div className="divide-y gap-0">
              {starredData?.items.map((item) => (
                <StarredMessageItem
                  key={item.message.id}
                  message={item.message}
                  attachment={item.attachment}
                  isOwnMessage={item.isOwnMessage}
                  onClick={() => handleResultClick(item.message.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface StarredMessageItemProps {
  message: {
    id: string;
    content: string;
    sender: string;
    senderId: string | null;
    senderName: string | null;
    timestamp: Date;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  attachment: Attachment | null;
  isOwnMessage: boolean;
  onClick: () => void;
}

function StarredMessageItem({
  message,
  attachment,
  isOwnMessage,
  onClick,
}: StarredMessageItemProps) {
  // Usar o senderName do campo direto da mensagem
  const displayName = message.senderName ?? (message.sender === "agent" ? "Agente" : "Contato");

  // Se tem attachment, não precisa extrair nome do conteúdo
  // Se não tem attachment, extrair do formato **Nome**\nConteúdo
  const extractNameAndContent = (content: string) => {
    const regex = /^\*\*(.+?)\*\*\n([\s\S]*)$/;
    const match = regex.exec(content);
    if (match) {
      return {
        name: match[1],
        content: match[2],
      };
    }
    return {
      name: null,
      content,
    };
  };

  const { content } = extractNameAndContent(message.content);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="w-full text-left p-4 bg-accent/50 hover:bg-accent/60 transition-colors cursor-pointer"
    >
      {/* Header: Data + Ícone + Nome */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm">
            {format(new Date(message.timestamp), "dd/MM/yyyy HH:mm")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayName}</span>
        </div>
      </div>

      {/* Conteúdo da mensagem como bubble com alinhamento */}
      <div className={cn("flex gap-2 mb-2", isOwnMessage ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[280px] overflow-hidden rounded-sm sm:max-w-md md:max-w-lg lg:max-w-xl",
            "px-2 py-2",
            isOwnMessage ? "bg-msg-outgoing" : "bg-msg-incoming",
          )}
        >
          {/* Renderizar mídia se houver attachment */}
          {attachment && (
            <div onClick={(e) => e.stopPropagation()}>
              <ChatMessageAttachment
                attachment={attachment}
                messageId={message.id}
                isOwnMessage={isOwnMessage}
                disableLightbox={true}
              />
            </div>
          )}
          {/* Renderizar conteúdo de texto se houver */}
          {content?.trim() && (
            <p className={cn("overflow-wrap-anywhere break-word text-sm whitespace-pre-wrap", isOwnMessage && "dark:text-white")}>
              {content}
            </p>
          )}

          {/* Footer com estrela, timestamp e status */}
          <div className="mt-1 flex items-center justify-end gap-1">
            <Star className="h-3 w-3 fill-current opacity-70" />
            <span className="text-xs opacity-70">
              {formatMessageTimestamp(new Date(message.timestamp))}
            </span>
            {isOwnMessage && message.status && (
              <span className="text-muted-foreground">
                {message.status === "read" ? (
                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                ) : message.status === "delivered" ? (
                  <CheckCheck className="h-3.5 w-3.5" />
                ) : message.status === "sent" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
