"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
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
  DialogTrigger,
} from "@manylead/ui/dialog";
import { Textarea } from "@manylead/ui/textarea";

import { useTRPC } from "~/lib/trpc/react";

interface ChatCommentDialogProps {
  chatId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ChatCommentDialog({ chatId, open: controlledOpen, onOpenChange }: ChatCommentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [comment, setComment] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation(
    trpc.messages.addComment.mutationOptions({
      onSuccess: () => {
        setComment("");
        setOpen(false);
        // Invalidar lista de mensagens para mostrar o comentário
        void queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao adicionar comentário");
      },
    }),
  );

  const handleSubmit = () => {
    if (!comment.trim()) {
      toast.error("Digite um comentário");
      return;
    }

    addCommentMutation.mutate({
      chatId,
      content: comment.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default">
          <MessageSquare className="mr-2 h-4 w-4" />
          Comentário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Inserir comentário</DialogTitle>
          <DialogDescription>
            Este comentário é privado e não será enviado ao cliente
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="Digite seu comentário..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={addCommentMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={addCommentMutation.isPending || !comment.trim()}
          >
            {addCommentMutation.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
