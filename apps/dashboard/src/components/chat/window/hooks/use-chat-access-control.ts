"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const hasMarkedAsReadRef = useRef(false);
  const isMountedRef = useRef(true);
  const { showAccessDeniedModal } = useAccessDeniedModal();
  const { data: currentAgent } = useCurrentAgent();

  // Mutation para marcar chat como lido
  const markAsReadMutation = useMutation(
    trpc.chats.markAsRead.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });
      },
    })
  );

  // Mutation para marcar todas as mensagens como lidas
  const markAllMessagesAsReadMutation = useMutation(
    trpc.messages.markAllAsRead.mutationOptions()
  );

  // Resetar flag quando trocar de chat
  useEffect(() => {
    hasMarkedAsReadRef.current = false;
  }, [chatId]);

  // Controlar estado de montagem do componente
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Marcar chat como lido quando abrir (apenas uma vez por chat)
  useEffect(() => {
    if (chatItem && !hasMarkedAsReadRef.current && chatItem.chat.unreadCount > 0) {
      // Verificar se o chat está realmente ativo na URL
      const currentPath = window.location.pathname;
      const isInThisChat = currentPath.includes(`/chats/${chatId}`);

      if (!isInThisChat) {
        return; // Não marcar como lido se não estiver vendo o chat
      }

      // REGRA: Só marcar como lido se o chat estiver assigned ao agente atual
      const isAssignedToMe = chatItem.chat.assignedTo === currentAgent?.id;

      if (!isAssignedToMe) {
        return; // Não marcar como lido se não estiver assigned ao usuário
      }

      hasMarkedAsReadRef.current = true;

      // Marcar o chat como lido (zera unreadCount)
      markAsReadMutation.mutate({
        id: chatItem.chat.id,
        createdAt: chatItem.chat.createdAt,
      });

      // Marcar todas as mensagens do contato como lidas (atualiza ticks)
      markAllMessagesAsReadMutation.mutate({
        chatId: chatItem.chat.id,
      });
    }
  }, [chatItem, markAsReadMutation, markAllMessagesAsReadMutation, chatId, currentAgent]);

  // Marcar como lido automaticamente quando receber mensagem no chat ativo
  useSocketListener(
    socket,
    "onMessageNew",
    (event) => {
      // Verificar se componente ainda está montado
      if (!isMountedRef.current) return;

      // Verificar em tempo real se ainda está no chat
      const currentPath = window.location.pathname;
      const isInThisChat = currentPath.includes(`/chats/${chatId}`);

      if (!isInThisChat) return;

      // REGRA: Só marcar como lido se o chat estiver assigned ao agente atual
      const isAssignedToMe = chatItem?.chat.assignedTo === currentAgent?.id;

      if (!isAssignedToMe) {
        return; // Não marcar como lido se não estiver assigned ao usuário
      }

      const messageChatId = event.message.chatId as string;
      if (messageChatId === chatId && chatItem) {
        // Marcar o chat como lido (zera unreadCount)
        markAsReadMutation.mutate({
          id: chatItem.chat.id,
          createdAt: chatItem.chat.createdAt,
        });

        // Marcar todas as mensagens do contato como lidas (atualiza ticks)
        markAllMessagesAsReadMutation.mutate({
          chatId: chatItem.chat.id,
        });
      }
    },
    [chatId, chatItem, markAsReadMutation, markAllMessagesAsReadMutation, currentAgent],
    !!chatItem // enabled only if chatItem exists
  );

  // Detectar quando o chat é atualizado (transferência/assignment)
  useSocketListener(
    socket,
    "onChatUpdated",
    (event) => {
      if (!chatItem || !currentAgent) return;

      const updatedChatId = event.chat.id as string;
      const updatedAssignedTo = event.chat.assignedTo as string | null;
      const updatedUnreadCount = event.chat.unreadCount as number;

      // Só processar se for o chat atual
      if (updatedChatId !== chatId) return;

      // CASO 1: Chat foi transferido PARA o agente atual (marcar como lido)
      if (
        updatedAssignedTo === currentAgent.id &&
        chatItem.chat.assignedTo !== currentAgent.id && // Estava assigned para outro (ou null)
        updatedUnreadCount > 0 // Só marcar se realmente tem mensagens não lidas (evita loop)
      ) {

        // Verificar se o chat está realmente ativo na URL
        const currentPath = window.location.pathname;
        const isInThisChat = currentPath.includes(`/chats/${chatId}`);

        if (isInThisChat) {
          // Marcar o chat como lido (zera unreadCount)
          markAsReadMutation.mutate({
            id: chatItem.chat.id,
            createdAt: chatItem.chat.createdAt,
          });

          // Marcar todas as mensagens do contato como lidas (atualiza ticks)
          markAllMessagesAsReadMutation.mutate({
            chatId: chatItem.chat.id,
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
        // Mostrar modal global e redirecionar
        showAccessDeniedModal();
      }
    },
    [
      chatId,
      chatItem,
      currentAgent,
      markAsReadMutation,
      markAllMessagesAsReadMutation,
      showAccessDeniedModal,
    ],
    !!(chatItem && currentAgent)
  );
}
