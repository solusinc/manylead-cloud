"use client";

import type * as React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Image, MessageSquare, Music, Pencil, StickyNote, Trash2, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Input } from "@manylead/ui/input";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@manylead/ui/alert-dialog";
import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import type { ScheduledMessage } from "@manylead/db";

import { useTRPC } from "~/lib/trpc/react";
import { useChat } from "../providers/chat-context";
import { useScheduleMutations } from "./hooks";

interface ScheduleItemProps {
  item: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
    createdByUser?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
  onEdit?: (item: ScheduleItemProps["item"]) => void;
}

export function ScheduleItem({ item, onEdit }: ScheduleItemProps) {
  const trpc = useTRPC();
  const { chat } = useChat();
  const { cancel } = useScheduleMutations();
  const schedule = item.scheduledMessage;
  const isQuickReply = !!schedule.quickReplyId;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");

  // Buscar nome da organização para substituição de variáveis
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Buscar quick reply completa para exibir todas as mensagens
  const { data: quickReplyData } = useQuery({
    ...trpc.quickReplies.getById.queryOptions({ id: schedule.quickReplyId ?? "" }),
    enabled: isQuickReply && !!schedule.quickReplyId,
  });

  // Função para substituir variáveis no conteúdo
  const replaceVariables = (content: string) => {
    const contactName = chat.contact.name || chat.contact.phoneNumber;
    const agentName = item.createdByUser?.name ?? "";
    const organizationName = currentOrganization?.name ?? "";

    return content
      .replace(/\{\{contact\.name\}\}/g, contactName)
      .replace(/\{\{agent\.name\}\}/g, agentName)
      .replace(/\{\{organization\.name\}\}/g, organizationName);
  };

  const handleCancelConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await cancel.mutateAsync({
      id: schedule.id,
    });
    setShowDeleteDialog(false);
    setConfirmValue("");
  };

  const formatDateTime = (date: Date) => {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const isPending = schedule.status === "pending";
  const isSent = schedule.status === "sent";
  const isCancelled = schedule.status === "cancelled";

  const isMessage = schedule.contentType === "message";

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {/* Icon */}
          {isQuickReply ? (
            <Zap className="h-4 w-4 text-primary" />
          ) : isMessage ? (
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ) : (
            <StickyNote className="h-4 w-4 text-muted-foreground" />
          )}

          {/* Title */}
          <h3 className="text-sm font-medium">
            {isQuickReply
              ? schedule.quickReplyTitle ?? "Resposta Rápida"
              : isMessage
                ? "Mensagem"
                : "Nota"}
          </h3>
        </div>

        {/* Actions - only show for pending */}
        {isPending && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => onEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Editar</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={cancel.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cancelar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1 text-sm">
        <p>
          <span className="font-medium">Agendado para:</span>{" "}
          {isPending && formatDateTime(schedule.scheduledAt)}
          {isSent && schedule.sentAt && formatDateTime(schedule.sentAt)}
          {isCancelled && schedule.cancelledAt && formatDateTime(schedule.cancelledAt)}
        </p>

        {/* Canal - só mostrar se tiver informação disponível */}
        {/* <p>
          <span className="font-medium">Canal:</span> 👋 Boas vindas
        </p> */}

        {/* Atendente - se tiver createdByAgent disponível */}
        {/* <p>
          <span className="font-medium">Atendente:</span> {createdByAgent?.name}
        </p> */}
      </div>

      {/* Content box */}
      {isQuickReply && quickReplyData ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {quickReplyData.messages.length}{" "}
            {quickReplyData.messages.length === 1 ? "mensagem" : "mensagens"}
          </p>
          {quickReplyData.messages.map((msg, idx) => {
            const hasMedia = msg.mediaUrl && msg.type !== "text";

            const TypeIcon =
              msg.type === "image"
                ? Image
                : msg.type === "audio"
                  ? Music
                  : msg.type === "document"
                    ? FileText
                    : MessageSquare;

            const typeLabel =
              msg.type === "image"
                ? "Imagem"
                : msg.type === "audio"
                  ? "Áudio"
                  : msg.type === "document"
                    ? "Documento"
                    : "Texto";

            const previewContent = hasMedia && msg.content
              ? replaceVariables(msg.content)
              : hasMedia
                ? msg.mediaName ?? "[mídia]"
                : msg.content
                  ? replaceVariables(msg.content)
                  : "[sem conteúdo]";

            return (
              <div
                key={idx}
                className="rounded-lg border border-border bg-muted p-3"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <TypeIcon className="h-3.5 w-3.5" />
                  <span>{typeLabel}</span>
                </div>
                <p className="text-sm leading-relaxed">{previewContent}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={`rounded-lg border p-4 ${
            isMessage
              ? "border-border bg-muted"
              : "border-amber-300 bg-amber-50 dark:border-[#faad14] dark:bg-[#453316]"
          }`}
        >
          {isMessage && (
            <p className="mb-1 text-sm font-medium">
              {/* Atendente: Pode adicionar nome do agente aqui */}
            </p>
          )}
          <p className="text-sm leading-relaxed">{schedule.content}</p>
        </div>
      )}

      {/* Status badge e info adicional */}
      {(isSent || isCancelled) && (
        <div className="text-xs text-muted-foreground">
          {isSent && <span>✓ Enviado</span>}
          {isCancelled && schedule.cancellationReason && (
            <span>
              ✗ Cancelado
              {schedule.cancellationReason === "manual"
                ? " manualmente"
                : schedule.cancellationReason === "contact_message"
                  ? " - contato respondeu"
                  : schedule.cancellationReason === "agent_message"
                    ? " - atendente enviou msg"
                    : schedule.cancellationReason === "chat_closed"
                      ? " - chat finalizado"
                      : ""}
            </span>
          )}
        </div>
      )}

      {/* AlertDialog para confirmação de cancelamento */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent
          onCloseAutoFocus={() => {
            // NOTE: bug where the body is not clickable after closing the alert dialog
            document.body.style.pointerEvents = "";
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tem certeza que deseja deletar `este agendamento`?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isto irá remover permanentemente o
              registro do banco de dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form id="form-alert-dialog" className="space-y-0.5">
            <p className="text-muted-foreground text-xs">
              Por favor escreva &apos;
              <span className="font-semibold">cancelar</span>
              &apos; para confirmar
            </p>
            <Input value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} />
          </form>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40"
              disabled={confirmValue !== "cancelar" || cancel.isPending}
              form="form-alert-dialog"
              type="submit"
              onClick={handleCancelConfirm}
            >
              {cancel.isPending ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
