"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Pencil, StickyNote, Trash2 } from "lucide-react";

import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import type { ScheduledMessage } from "@manylead/db";

import { useScheduleMutations } from "./hooks";

interface ScheduleItemProps {
  item: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
  };
  onEdit?: (item: ScheduleItemProps["item"]) => void;
}

export function ScheduleItem({ item, onEdit }: ScheduleItemProps) {
  const { cancel } = useScheduleMutations();
  const schedule = item.scheduledMessage;

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;

    await cancel.mutateAsync({
      id: schedule.id,
    });
  };

  const formatDateTime = (date: Date) => {
    return format(new Date(date), "dd/MM/yyyy hh:mm a", { locale: ptBR });
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
          {isMessage ? (
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ) : (
            <StickyNote className="h-4 w-4 text-muted-foreground" />
          )}

          {/* Title */}
          <h3 className="text-sm font-medium">
            {isMessage ? "Mensagem" : "Nota"}
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
                  onClick={handleCancel}
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
    </div>
  );
}
