"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSocketListener } from "~/hooks/chat/use-socket-listener";
import type { UseChatSocketReturn } from "~/hooks/use-chat-socket";

/**
 * Hook para escutar eventos de socket relacionados a mensagens agendadas
 * e invalidar as queries apropriadas
 */
export function useScheduledMessageSocket(
  socket: UseChatSocketReturn,
  chatId: string,
) {
  const queryClient = useQueryClient();

  // Escutar evento de mensagem agendada enviada
  useSocketListener(
    socket,
    "onScheduledMessageSent",
    (event) => {
      // Apenas processar se for do chat atual
      if (event.chatId !== chatId) return;

      // Invalidar queries de scheduled messages para atualizar as tabs
      void queryClient.invalidateQueries({
        queryKey: [["scheduledMessages"]],
      });
    },
    [chatId, queryClient],
  );
}
