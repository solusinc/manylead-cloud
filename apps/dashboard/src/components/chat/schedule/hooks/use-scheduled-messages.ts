"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";

/**
 * Hook para buscar agendamentos de um chat
 */
export function useScheduledMessages(
  chatId: string,
  chatCreatedAt: Date,
  status?: "pending" | "sent" | "cancelled"
) {
  const trpc = useTRPC();

  return useQuery(
    trpc.scheduledMessages.listByChat.queryOptions({
      chatId,
      chatCreatedAt,
      status,
    })
  );
}

/**
 * Hook para buscar estatísticas de agendamentos
 */
export function useScheduledMessagesStats(chatId: string, chatCreatedAt: Date) {
  const trpc = useTRPC();

  return useQuery(
    trpc.scheduledMessages.stats.queryOptions({
      chatId,
      chatCreatedAt,
    })
  );
}

/**
 * Hook para buscar um agendamento específico
 */
export function useScheduledMessage(id: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.scheduledMessages.getById.queryOptions({
      id,
    })
  );
}
