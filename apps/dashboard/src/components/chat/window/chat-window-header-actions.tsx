"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { EyeOff, History, MoreVertical, Search, Star, User } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@manylead/ui/tooltip";

import { ChatTransferDropdown } from "./chat-transfer-dropdown";
import { ChatTagSelector } from "./chat-tag-selector";
import { ChatEndingSelector } from "./chat-ending-selector";
import { useTRPC } from "~/lib/trpc/react";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";

/**
 * Actions dropdown for chat window header
 * Extracted from chat-window-header.tsx (lines 205-319)
 */
export function ChatWindowHeaderActions({
  chat,
  chatId,
  chatCreatedAt,
  onOpenDetails,
  onOpenSearch,
  onOpenStarred,
  onOpenHistory,
  className,
}: {
  chat: {
    id: string;
    status: "open" | "closed";
    assignedTo: string | null;
  };
  chatId: string;
  chatCreatedAt: Date;
  onOpenDetails?: () => void;
  onOpenSearch?: () => void;
  onOpenStarred?: () => void;
  onOpenHistory?: () => void;
  className?: string;
}) {
  const trpc = useTRPC();
  const router = useRouter();

  // Buscar agent atual para verificar se está assigned
  const { data: currentAgent } = useCurrentAgent();

  // Mutation para marcar como não lida
  const markAsUnreadMutation = useMutation(
    trpc.chats.markAsUnread.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Erro ao marcar como não lida");
      },
    })
  );

  // Owner/Admin podem ver ações em chats PENDING
  // Members só veem se estiverem assigned
  const isOwnerOrAdmin = currentAgent?.role === "owner" || currentAgent?.role === "admin";
  const isAssigned = chat.assignedTo === currentAgent?.id;
  const isPending = chat.assignedTo === null;
  const isClosed = chat.status === "closed";

  // Mostrar ações se: (Owner/Admin vendo pending OU assigned ao usuário) E não fechado
  const showActions = ((isOwnerOrAdmin && isPending) || isAssigned) && !isClosed;

  const handleMarkAsUnread = () => {
    // Navegar primeiro para desmontar o chat-window (evita que markAsRead seja chamado)
    router.push("/chats");
    // Depois chamar a mutation em background
    markAsUnreadMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
    });
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {showActions && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ChatTransferDropdown chatId={chatId} chatCreatedAt={chatCreatedAt} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Transferir</p>
            </TooltipContent>
          </Tooltip>

          <ChatTagSelector chatId={chatId} chatCreatedAt={chatCreatedAt} />

          <ChatEndingSelector chatId={chatId} chatCreatedAt={chatCreatedAt} />
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More options" className="text-muted-foreground">
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpenDetails}>
            <User className="mr-2 h-4 w-4" />
            Informações do lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMarkAsUnread}>
            <EyeOff className="mr-2 h-4 w-4" />
            Marcar como não lida
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenSearch}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenStarred}>
            <Star className="mr-2 h-4 w-4" />
            Mensagens favoritas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenHistory}>
            <History className="mr-2 h-4 w-4" />
            Histórico
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
