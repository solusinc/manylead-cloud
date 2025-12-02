"use client";

import { Calendar, MessageSquare, X } from "lucide-react";

import type { ScheduledMessage } from "@manylead/db";

import { useChat } from "../providers/chat-context";
import { useScheduledMessages } from "./hooks";
import { ScheduleItem } from "./schedule-item";

interface ScheduleListProps {
  status: "pending" | "sent" | "cancelled";
  onEdit?: (item: {
    scheduledMessage: ScheduledMessage;
    createdByAgent: unknown;
  }) => void;
}

interface EmptyStateProps {
  status: string;
}

function EmptyState({ status }: EmptyStateProps) {
  const emptyStates = {
    pending: {
      icon: Calendar,
      title: "Nenhum agendamento pendente",
      description: "Crie um novo agendamento para enviar mensagens no futuro",
    },
    sent: {
      icon: MessageSquare,
      title: "Nenhuma mensagem enviada",
      description: "Agendamentos enviados aparecerão aqui",
    },
    cancelled: {
      icon: X,
      title: "Nenhum agendamento cancelado",
      description: "Agendamentos cancelados aparecerão aqui",
    },
  };

  const state = emptyStates[status as keyof typeof emptyStates];
  const Icon = state.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="text-muted-foreground mb-4 size-12" />
      <h3 className="mb-2 text-sm font-medium">{state.title}</h3>
      <p className="text-muted-foreground text-xs">{state.description}</p>
    </div>
  );
}

export function ScheduleList({ status, onEdit }: ScheduleListProps) {
  const { chat } = useChat();

  // Buscar agendamentos filtrados por status
  const { data: messages, isLoading } = useScheduledMessages(chat.id, chat.createdAt, status);

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">Carregando...</div>
    );
  }

  if (!messages || messages.length === 0) {
    return <EmptyState status={status} />;
  }

  return (
    <div className="space-y-3 p-4">
      {messages.map((item) => (
        <ScheduleItem
          key={item.scheduledMessage.id}
          item={item}
          onEdit={status === "pending" ? onEdit : undefined}
        />
      ))}
    </div>
  );
}
