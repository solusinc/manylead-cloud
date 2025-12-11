"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";

import { useAccessDeniedModal } from "~/components/providers/access-denied-modal-provider";
import { useChatSocketContext } from "~/components/providers/chat-socket-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";
import { useSocketListener } from "~/hooks/chat/use-socket-listener";

interface ChatItem {
  chat: {
    id: string;
    createdAt: Date;
    assignedTo: string | null;
    unreadCount: number;
  };
}

/**
 * Manages access control and auto-read marking for chat
 * Extracted from chat-window.tsx (lines 85-225)
 */
export function useChatAccessControl(chatId: string, chatItem: ChatItem | undefined) {
  const trpc = useTRPC();
  const socket = useChatSocketContext();
  const hasMarkedAsReadRef = useRef(false);
  const hasProcessedChatUpdateRef = useRef(false); // Prevent duplicate onChatUpdated
  const isMountedRef = useRef(true);
  const { showAccessDeniedModal } = useAccessDeniedModal();
  const { data: currentAgent } = useCurrentAgent();

  // Mutation para marcar chat como lido
  const markAsReadMutation = useMutation(
    trpc.chats.markAsRead.mutationOptions({
      onSuccess: () => {
        // Don't invalidate - socket will emit onChatUpdated
        // Avoids duplicate queries
      },
    })
  );

  // Mutation para marcar todas as mensagens como lidas
  const markAllMessagesAsReadMutation = useMutation(
    trpc.messages.markAllAsRead.mutationOptions()
  );

  // Resetar flags quando trocar de chat
  useEffect(() => {
    hasMarkedAsReadRef.current = false;
    hasProcessedChatUpdateRef.current = false;
  }, [chatId]);

  // Controlar estado de montagem do componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Extract stable values to prevent re-runs on cache updates
  const chatCreatedAt = chatItem?.chat.createdAt;
  const unreadCount = chatItem?.chat.unreadCount ?? 0;
  const assignedTo = chatItem?.chat.assignedTo;

  // Marcar chat como lido quando abrir pela PRIMEIRA VEZ (não quando assigned)
  // IMPORTANTE: Não dispara quando assignedTo muda (evita duplicação com onChatUpdated)
  useEffect(() => {
    // Só marcar se já estava assigned desde o início E ainda não marcou
    if (!hasMarkedAsReadRef.current && unreadCount > 0 && assignedTo === currentAgent?.id) {
      // Verificar se o chat está realmente ativo na URL
      const currentPath = window.location.pathname;
      const isInThisChat = currentPath.includes(`/chats/${chatId}`);

      if (!isInThisChat) {
        return; // Não marcar como lido se não estiver vendo o chat
      }

      hasMarkedAsReadRef.current = true;

      // Marcar o chat como lido (zera unreadCount)
      if (chatCreatedAt) {
        markAsReadMutation.mutate({
          id: chatId,
          createdAt: chatCreatedAt,
        });
      }

      // Marcar todas as mensagens do contato como lidas (atualiza ticks)
      markAllMessagesAsReadMutation.mutate({
        chatId: chatId,
      });
    }
  }, [chatId, chatCreatedAt, unreadCount, assignedTo, markAsReadMutation, markAllMessagesAsReadMutation, currentAgent?.id]);

  // Marcar como lido automaticamente quando receber mensagem no chat ativo
  // NOTA: Não marca automaticamente - espera usuário abrir o chat ou onChatUpdated disparar
  // Removido para evitar duplicação com onChatUpdated (linha 140)

  // Detectar quando o chat é atualizado (transferência/assignment)
  useSocketListener(
    socket,
    "onChatUpdated",
    (event) => {
      if (!chatCreatedAt || !currentAgent) return;

      const updatedChatId = event.chat.id as string;
      const updatedAssignedTo = event.chat.assignedTo as string | null;
      const updatedUnreadCount = event.chat.unreadCount as number;

      // Só processar se for o chat atual
      if (updatedChatId !== chatId) return;

      // CASO 1: Chat foi transferido PARA o agente atual (marcar como lido)
      if (
        updatedAssignedTo === currentAgent.id &&
        assignedTo !== currentAgent.id && // Estava assigned para outro (ou null)
        updatedUnreadCount > 0 && // Só marcar se realmente tem mensagens não lidas (evita loop)
        !hasProcessedChatUpdateRef.current // Prevenir processamento duplicado
      ) {

        // Verificar se o chat está realmente ativo na URL
        const currentPath = window.location.pathname;
        const isInThisChat = currentPath.includes(`/chats/${chatId}`);

        if (isInThisChat) {
          hasProcessedChatUpdateRef.current = true; // Mark as processed

          // Marcar o chat como lido (zera unreadCount)
          markAsReadMutation.mutate({
            id: chatId,
            createdAt: chatCreatedAt,
          });

          // Marcar todas as mensagens do contato como lidas (atualiza ticks)
          markAllMessagesAsReadMutation.mutate({
            chatId: chatId,
          });
        }
      }

      // CASO 2: Chat foi transferido PARA outro agent - bloquear acesso (APENAS members)
      // Owner/Admin podem ver todos os chats
      if (
        currentAgent.role !== "owner" &&
        currentAgent.role !== "admin" &&
        updatedAssignedTo &&
        updatedAssignedTo !== currentAgent.id
      ) {
        // Verificar se o usuário ainda está vendo este chat
        const currentPath = window.location.pathname;
        const isInThisChat = currentPath.includes(`/chats/${chatId}`);

        // Só mostrar modal se realmente estiver no chat
        if (isInThisChat) {
          // Mostrar modal global e redirecionar
          showAccessDeniedModal();
        }
      }
    },
    [
      chatId,
      chatCreatedAt,
      assignedTo,
      currentAgent,
      markAsReadMutation,
      markAllMessagesAsReadMutation,
      showAccessDeniedModal,
    ],
    !!(chatCreatedAt && currentAgent)
  );
}
