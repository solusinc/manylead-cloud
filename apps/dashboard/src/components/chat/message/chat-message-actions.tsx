"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  MessageCircle,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";

import { useTRPC } from "~/lib/trpc/react";
import { useChatReply } from "../providers/chat-reply-provider";
import { EditMessageDialog, DeleteMessageDialog } from "./chat-message-dialogs";
import type { Message } from "./chat-message";

/**
 * Menu de ações da mensagem (responder, favoritar, editar, deletar)
 */
export function ChatMessageActions({
  message,
  isOutgoing,
  onOpenChange,
  canEditMessages = false,
  canDeleteMessages = false,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  onOpenChange?: (open: boolean) => void;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
  className?: string;
}) {
  // Hooks devem vir ANTES de qualquer return condicional
  const { setReplyingTo, contactName } = useChatReply();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Não mostrar menu de ações para mensagens deletadas
  if (message.isDeleted) {
    return null;
  }

  const handleReply = () => {
    // Extrair nome do sender do conteúdo (formato: **Nome**\nConteúdo)
    const match = /^\*\*(.*?)\*\*/.exec(message.content);
    const senderName = match?.[1] ?? (isOutgoing ? "Você" : contactName);

    setReplyingTo({
      id: message.id,
      content: message.content,
      senderName,
      timestamp: message.timestamp,
    });
  };

  // Não pode editar/deletar se a mensagem já foi lida
  // EXCETO para mídias: sempre pode deletar mensagens com attachment (imagem/vídeo)
  const hasMedia = !!message.attachment;
  const canEdit = canEditMessages && isOutgoing && !message.readAt && !message.isDeleted;
  const canDelete = canDeleteMessages && isOutgoing && (hasMedia || !message.readAt) && !message.isDeleted;

  const handleDownload = async () => {
    if (!message.attachment?.storageUrl) return;

    try {
      // Fetch da URL da mídia
      const response = await fetch(message.attachment.storageUrl);
      const blob = await response.blob();

      // Criar URL temporária do blob
      const blobUrl = URL.createObjectURL(blob);

      // Criar link de download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = message.attachment.fileName || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Limpar URL do blob
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Erro ao fazer download:", error);
    }
  };

  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-sm hover:bg-transparent! hover:text-current! focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent!",
              isOutgoing
                ? "text-foreground/60 dark:text-white/70"
                : "text-muted-foreground",
              className,
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-background/95 w-48 backdrop-blur-sm"
        >
          <DropdownMenuItem
            className="cursor-pointer gap-3"
            onClick={handleReply}
          >
            <MessageCircle className="h-4 w-4" />
            <span>Responder</span>
          </DropdownMenuItem>
          <ChatMessageActionStar message={message} />
          {hasMedia && (
            <DropdownMenuItem
              className="cursor-pointer gap-3"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem
              className="cursor-pointer gap-3"
              onSelect={() => setEditDialogOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer gap-3"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span>Deletar</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs renderizados FORA do DropdownMenu */}
      <EditMessageDialog
        message={message}
        open={editDialogOpen && canEdit}
        onOpenChange={setEditDialogOpen}
      />
      <DeleteMessageDialog
        message={message}
        open={deleteDialogOpen && canDelete}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}

/**
 * Ação de favoritar/desfavoritar mensagem
 */
export function ChatMessageActionStar({ message }: { message: Message }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const toggleStarMutation = useMutation(
    trpc.messages.toggleStar.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao favoritar mensagem");
      },
    }),
  );

  const handleToggleStar = () => {
    toggleStarMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      isStarred: !message.isStarred,
    });
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer gap-3"
      onClick={handleToggleStar}
      disabled={toggleStarMutation.isPending}
    >
      <Star className={cn("h-4 w-4", message.isStarred && "fill-current")} />
      <span>{message.isStarred ? "Desfavoritar" : "Favoritar"}</span>
    </DropdownMenuItem>
  );
}
