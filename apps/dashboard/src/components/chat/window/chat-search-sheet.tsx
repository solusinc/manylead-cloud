"use client";

import { useState, useRef, useEffect } from "react";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Attachment } from "@manylead/db";

import { cn } from "@manylead/ui";
import { Input } from "@manylead/ui/input";
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
import { ChatImagesProvider } from "../message/chat-images-context";

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

interface ChatSearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  contactName: string;
}

export function ChatSearchSheet({
  open,
  onOpenChange,
  chatId,
  contactName,
}: ChatSearchSheetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trpc = useTRPC();
  const setFocusMessage = useMessageFocusStore((state) => state.setFocusMessage);

  // Resetar e focar input quando abrir
  useEffect(() => {
    if (open) {
      // Resetar input
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchTerm("");
      // Timeout para aguardar animação do sheet
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Buscar mensagens quando tiver termo de busca
  const { data: searchResults, isLoading } = useQuery({
    ...trpc.messages.search.queryOptions({
      chatId,
      query: searchTerm,
      limit: 20,
    }),
    enabled: open && searchTerm.length >= 2,
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
            Buscar no atendimento
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

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={`Pesquisar em ${contactName}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searchTerm.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Digite pelo menos 2 caracteres para buscar
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Buscando...
            </p>
          ) : searchResults?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma mensagem encontrada
            </p>
          ) : (
            <ChatImagesProvider>
              <div className="divide-y gap-0">
                {searchResults?.items.map((item) => (
                  <SearchResultBubble
                    key={item.message.id}
                    message={item.message}
                    attachment={item.attachment}
                    isOwnMessage={item.isOwnMessage}
                    contactName={contactName}
                    onClick={() => handleResultClick(item.message.id)}
                  />
                ))}
              </div>
            </ChatImagesProvider>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SearchResultBubbleProps {
  message: {
    id: string;
    content: string;
    sender: string;
    senderName: string | null;
    timestamp: Date;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  attachment: Attachment | null;
  isOwnMessage: boolean;
  contactName: string;
  onClick: () => void;
}

function SearchResultBubble({
  message,
  attachment,
  isOwnMessage,
  contactName,
  onClick,
}: SearchResultBubbleProps) {
  // Usar o senderName do campo direto da mensagem, ou contactName do chat
  const senderName = message.senderName ?? (message.sender === "agent" ? "Agente" : contactName);

  // Extrair conteúdo sem formatação **Nome**\n
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
      {/* Bubble igual ao chat message list */}
      <div className={cn("flex gap-2 mb-2", isOwnMessage ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[280px] overflow-hidden rounded-sm sm:max-w-md md:max-w-lg lg:max-w-xl",
            "px-2 py-2",
            isOwnMessage ? "bg-msg-outgoing" : "bg-msg-incoming",
          )}
        >
          {/* Assinatura - nome do sender */}
          {senderName && (
            <p className={cn("text-sm font-semibold mb-2", isOwnMessage && "dark:text-white")}>
              {senderName}
            </p>
          )}

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

          {/* Footer com data formatada estilo WhatsApp */}
          <div className="mt-1 flex items-center justify-end gap-1">
            <span className="text-xs opacity-70">
              {formatMessageTimestamp(new Date(message.timestamp))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
