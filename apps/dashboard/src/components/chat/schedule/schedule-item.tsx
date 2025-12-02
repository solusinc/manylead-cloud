"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, MessageSquare, Pencil, StickyNote, Trash2, X } from "lucide-react";

import { Badge } from "@manylead/ui/badge";
import { Button } from "@manylead/ui/button";
import { Card } from "@manylead/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
    return format(new Date(date), "dd/MMM 'às' HH:mm", { locale: ptBR });
  };

  const isPending = schedule.status === "pending";
  const isSent = schedule.status === "sent";
  const isCancelled = schedule.status === "cancelled";

  const autoCancelFlags = [
    schedule.cancelOnContactMessage && "Contato responder",
    schedule.cancelOnAgentMessage && "Atendente enviar msg",
    schedule.cancelOnChatClose && "Chat finalizar",
  ].filter(Boolean) as string[];

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        {/* Header: Type badge + Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {schedule.contentType === "message" ? (
              <MessageSquare className="text-muted-foreground size-4" />
            ) : (
              <StickyNote className="text-muted-foreground size-4" />
            )}
            <Badge variant={schedule.contentType === "message" ? "default" : "secondary"}>
              {schedule.contentType === "message" ? "Mensagem" : "Nota"}
            </Badge>
            <Badge
              variant={isPending ? "outline" : isSent ? "default" : "destructive"}
              className="text-xs"
            >
              {isPending && "Agendado"}
              {isSent && "Enviado"}
              {isCancelled && "Cancelado"}
            </Badge>
          </div>

          {isPending && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Editar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={handleCancel}
                      disabled={cancel.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancelar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Content */}
        <p className="text-sm line-clamp-3">{schedule.content}</p>

        {/* Scheduled time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          {isPending && <span>Agendado para {formatDateTime(schedule.scheduledAt)}</span>}
          {isSent && schedule.sentAt && <span>Enviado em {formatDateTime(schedule.sentAt)}</span>}
          {isCancelled && schedule.cancelledAt && (
            <span>Cancelado em {formatDateTime(schedule.cancelledAt)}</span>
          )}
        </div>

        {/* Auto-cancel flags (only for pending) */}
        {isPending && autoCancelFlags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {autoCancelFlags.map((flag) => (
              <Badge key={flag} variant="outline" className="text-xs">
                <X className="mr-1 size-3" />
                {flag}
              </Badge>
            ))}
          </div>
        )}

        {/* Cancellation reason */}
        {isCancelled && schedule.cancellationReason && (
          <p className="text-muted-foreground text-xs">
            Motivo:{" "}
            {schedule.cancellationReason === "manual"
              ? "Cancelado manualmente"
              : schedule.cancellationReason === "contact_message"
                ? "Contato enviou mensagem"
                : schedule.cancellationReason === "agent_message"
                  ? "Atendente enviou mensagem"
                  : schedule.cancellationReason === "chat_closed"
                    ? "Chat foi finalizado"
                    : schedule.cancellationReason}
          </p>
        )}
      </div>
    </Card>
  );
}
