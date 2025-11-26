"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search, X, Check, CheckCheck, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
  const trpc = useTRPC();
  const setFocusMessage = useMessageFocusStore((state) => state.setFocusMessage);

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
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden">
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
              type="text"
              placeholder={`Pesquisar em ${contactName}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
            searchResults?.items.map((item) => (
              <SearchResultBubble
                key={item.message.id}
                message={item.message}
                onClick={() => handleResultClick(item.message.id)}
              />
            ))
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
    timestamp: Date;
    status?: string | null;
  };
  onClick: () => void;
}

function SearchResultBubble({
  message,
  onClick,
}: SearchResultBubbleProps) {
  const isOutgoing = message.sender === "agent";

  // Remover formatação **Nome**\n do conteúdo (se houver)
  const cleanContent = message.content.replace(/^\*\*.*?\*\*\n/, "");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left transition-transform hover:scale-[1.02] active:scale-[0.98]",
        "flex",
        isOutgoing ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2",
          isOutgoing
            ? "bg-msg-outgoing rounded-br-sm"
            : "bg-msg-incoming rounded-bl-sm",
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {cleanContent}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.timestamp), "dd/MM/yy HH:mm")}
          </span>
          {isOutgoing && (
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
    </button>
  );
}
