"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import { Textarea } from "@manylead/ui/textarea";

import { useTRPC } from "~/lib/trpc/react";
import type { Message } from "./chat-message";

/**
 * Dialog para editar mensagem
 */
export function EditMessageDialog({
  message,
  open,
  onOpenChange,
}: {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Extrair conteúdo sem assinatura
  const contentWithoutSignature = React.useMemo(
    () => message.content.replace(/^\*\*.*?\*\*\n/, ""),
    [message.content]
  );

  const [editContent, setEditContent] = useState(contentWithoutSignature);

  const editMutation = useMutation(
    trpc.messages.edit.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        onOpenChange(false);
        toast.success("Mensagem editada");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao editar mensagem");
      },
    }),
  );

  const handleSave = () => {
    if (!editContent.trim() || !message.chatId) return;

    editMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      chatId: message.chatId,
      content: editContent.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" key={`edit-${message.id}-${open ? 'open' : 'closed'}`}>
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Edite o conteúdo da sua mensagem
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="resize-none"
            placeholder="Digite sua mensagem..."
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={editMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={editMutation.isPending || !editContent.trim()}
          >
            {editMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog para deletar mensagem
 */
export function DeleteMessageDialog({
  message,
  open,
  onOpenChange,
}: {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.messages.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao deletar mensagem");
      },
    }),
  );

  const handleDelete = () => {
    if (!message.chatId) return;

    deleteMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      chatId: message.chatId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deletar mensagem</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar esta mensagem? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deletando..." : "Deletar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
