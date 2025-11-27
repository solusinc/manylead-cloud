"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, User, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { cn } from "@manylead/ui";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@manylead/ui/sheet";
import { Button } from "@manylead/ui/button";
import { useTRPC } from "~/lib/trpc/react";

interface ChatHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  currentChatId: string;
}

export function ChatHistorySheet({
  open,
  onOpenChange,
  contactId,
  currentChatId,
}: ChatHistorySheetProps) {
  const trpc = useTRPC();
  const router = useRouter();

  // Buscar histórico de atendimentos
  const { data: historyData, isLoading } = useQuery({
    ...trpc.chats.history.queryOptions({
      contactId,
      currentChatId,
    }),
    enabled: open,
  });

  const handleItemClick = (chatId: string) => {
    onOpenChange(false);
    router.push(`/chats/${chatId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:hidden">
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <SheetTitle className="text-base font-semibold">
            Histórico de atendimentos
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
          ) : historyData?.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum atendimento encontrado
            </p>
          ) : (
            <div className="divide-y">
              {historyData?.items.map((item) => (
                <HistoryItem
                  key={`${item.id}-${item.createdAt.toISOString()}`}
                  item={item}
                  onClick={() => handleItemClick(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface HistoryItemProps {
  item: {
    id: string;
    createdAt: Date;
    status: string;
    closedAt: Date | null;
    assignedAgentName: string | null;
    isCurrent: boolean;
  };
  onClick: () => void;
}

function HistoryItem({ item, onClick }: HistoryItemProps) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Em atendimento";
      case "pending":
        return "Aguardando atendimento";
      case "closed":
        return "Finalizado";
      case "snoozed":
        return "Adiado";
      default:
        return status;
    }
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 space-y-0 hover:bg-accent/50 transition-colors cursor-pointer",
        item.isCurrent && "bg-msg-outgoing",
      )}
    >
      {/* Nome do agente */}
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {item.assignedAgentName ?? "Não atribuído"}
        </span>
      </div>

      {/* Status - se finalizado com data, mostrar só a data */}
      <div className="flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {item.status === "closed" && item.closedAt
            ? `Finalizado em ${format(new Date(item.closedAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`
            : getStatusLabel(item.status)}
        </span>
      </div>
    </button>
  );
}
