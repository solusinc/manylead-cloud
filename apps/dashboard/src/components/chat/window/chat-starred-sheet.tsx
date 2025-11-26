"use client";

import { format } from "date-fns";
import { Calendar, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

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
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-md [&>button]:hidden">
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
            <div className="divide-y">
              {starredData?.items.map((item) => (
                <StarredMessageItem
                  key={item.message.id}
                  message={item.message}
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
    timestamp: Date;
    metadata?: Record<string, unknown> | null;
  };
  isOwnMessage: boolean;
  onClick: () => void;
}

function StarredMessageItem({
  message,
  onClick,
}: StarredMessageItemProps) {
  // Extrair nome do agente do conteúdo formatado **Nome**\nConteúdo
  const extractNameAndContent = (content: string) => {
    const match = content.match(/^\*\*(.+?)\*\*\n([\s\S]*)$/);
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

  const { name, content } = extractNameAndContent(message.content);
  const displayName = name ?? (message.sender === "agent" ? "Agente" : "Contato");

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
    >
      {/* Header: Data + Ícone + Nome */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm">
            {format(new Date(message.timestamp), "HH:mm")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{displayName}</span>
        </div>
      </div>

      {/* Conteúdo da mensagem como bubble */}
      <div
        className={cn(
          "rounded-2xl px-4 py-2 inline-block max-w-full",
          "bg-msg-outgoing rounded-br-sm",
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {content}
        </p>
      </div>
    </button>
  );
}
