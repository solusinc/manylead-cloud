"use client";

import { useState } from "react";
import { Calendar, MessageSquare } from "lucide-react";

import type { ScheduledMessage } from "@manylead/db";
import { Badge } from "@manylead/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@manylead/ui/tabs";

import { useChat } from "../providers/chat-context";
import { useScheduledMessages, useScheduledMessagesStats } from "./hooks";
import { ScheduleItem } from "./schedule-item";

interface ScheduleListProps {
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
      icon: Calendar,
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

export function ScheduleList({ onEdit }: ScheduleListProps) {
  const { chat } = useChat();
  const [activeTab, setActiveTab] = useState<"pending" | "sent" | "cancelled">("pending");

  // Buscar estatísticas para badges
  const { data: stats } = useScheduledMessagesStats(chat.id, chat.createdAt);

  // Buscar agendamentos do tab ativo
  const { data: messages, isLoading } = useScheduledMessages(chat.id, chat.createdAt, activeTab);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="pending" className="relative">
          Agendados
          {stats && stats.pending > 0 && (
            <Badge variant="default" className="ml-2 h-5 min-w-5 px-1 text-xs">
              {stats.pending}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="sent" className="relative">
          Enviados
          {stats && stats.sent > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
              {stats.sent}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="cancelled" className="relative">
          Cancelados
          {stats && stats.cancelled > 0 && (
            <Badge variant="outline" className="ml-2 h-5 min-w-5 px-1 text-xs">
              {stats.cancelled}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4 space-y-3">
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Carregando...</div>
        ) : messages && messages.length > 0 ? (
          messages.map((item) => (
            <ScheduleItem key={item.scheduledMessage.id} item={item} onEdit={onEdit} />
          ))
        ) : (
          <EmptyState status="pending" />
        )}
      </TabsContent>

      <TabsContent value="sent" className="mt-4 space-y-3">
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Carregando...</div>
        ) : messages && messages.length > 0 ? (
          messages.map((item) => <ScheduleItem key={item.scheduledMessage.id} item={item} />)
        ) : (
          <EmptyState status="sent" />
        )}
      </TabsContent>

      <TabsContent value="cancelled" className="mt-4 space-y-3">
        {isLoading ? (
          <div className="text-muted-foreground py-8 text-center text-sm">Carregando...</div>
        ) : messages && messages.length > 0 ? (
          messages.map((item) => <ScheduleItem key={item.scheduledMessage.id} item={item} />)
        ) : (
          <EmptyState status="cancelled" />
        )}
      </TabsContent>
    </Tabs>
  );
}
