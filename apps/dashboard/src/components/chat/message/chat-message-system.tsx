"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  ChevronDown,
  MessageCircle,
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
import type { Message } from "./chat-message";

/**
 * Comentário interno do agente (privado, não visível ao cliente)
 */
export function ChatMessageComment({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  const agentName = message.metadata?.agentName as string | undefined;
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cn("group mb-4 flex justify-center", className)}>
      <div
        className="relative flex max-w-2xl items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:bg-emerald-950/80"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {agentName ?? "Agente"}
          </p>
          <p className="text-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        {(isHovered || isMenuOpen) && (
          <div className="absolute top-1 right-1 rounded-full bg-emerald-50/80 p-0.5 transition-all duration-200 dark:bg-emerald-950/90">
            <ChatCommentActions
              message={message}
              onOpenChange={setIsMenuOpen}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ações do comentário (deletar)
 */
export function ChatCommentActions({
  message,
  onOpenChange,
  className,
}: {
  message: Message;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteCommentMutation = useMutation(
    trpc.messages.deleteComment.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao remover comentário");
      },
    }),
  );

  const handleDelete = () => {
    if (!message.chatId) {
      toast.error("Erro ao identificar o chat");
      return;
    }

    deleteCommentMutation.mutate({
      id: message.id,
      chatId: message.chatId,
    });
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-sm text-emerald-600 hover:bg-transparent! hover:text-current! dark:text-emerald-400",
            "data-[state=open]:bg-transparent! focus-visible:ring-0 focus-visible:ring-offset-0",
            className,
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="bg-background/95 w-48 backdrop-blur-sm"
      >
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer gap-3"
          onClick={handleDelete}
          disabled={deleteCommentMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
          <span>Deletar comentário</span>
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
    const fields = lines.reduce(
      (acc, line) => {
        const [key, ...valueParts] = line.split(": ");
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join(": ").trim();
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return (
      <div className={cn("mb-4 flex justify-center", className)}>
        <div className="w-full max-w-4xl rounded-lg bg-white px-4 py-3 text-sm shadow-sm dark:bg-muted/90">
          {/* Layout em 2 colunas em md/lg */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {/* Coluna 1 */}
            <div className="space-y-2">
              {fields.Protocolo && (
                <div>
                  <span className="text-muted-foreground">Protocolo:</span>{" "}
                  <span className="font-semibold break-all">
                    {fields.Protocolo}
                  </span>
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
                  <span className="font-semibold">
                    {fields.Departamento || "-"}
                  </span>
                </div>
              )}
              {fields.Motivo !== undefined && (
                <div>
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  <span className="font-semibold">{fields.Motivo || "-"}</span>
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
                  <span className="font-semibold">
                    {fields["Finalizado em"]}
                  </span>
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
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-sm dark:bg-muted/90">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
