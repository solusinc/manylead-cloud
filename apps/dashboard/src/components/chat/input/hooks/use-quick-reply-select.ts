"use client";

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";

import type { QuickReplySelection } from "../quick-reply-dropdown";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useChatReply } from "../../providers/chat-reply-provider";
import { useNotificationSound } from "~/hooks/use-notification-sound";

/**
 * Handles quick reply selection and sending via backend
 */
export function useQuickReplySelect(chatId: string) {
  const queryClient = useQueryClient();
  const session = useServerSession();
  const trpc = useTRPC();
  const { contactName } = useChatReply();
  const { playNotificationSound } = useNotificationSound();

  // Buscar organização atual
  const { data: currentOrganization } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  const sendQuickReplyMutation = useMutation(
    trpc.quickReplies.send.mutationOptions(),
  );

  /**
   * Handle quick reply selection
   * - Single text message without media: Returns content to be placed in input
   * - Multiple messages or with media: Sends via backend
   */
  const handleQuickReplySelect = async (selection: QuickReplySelection): Promise<string | null> => {
    const { messages } = selection;

    if (messages.length === 0) {
      return null;
    }

    // Se tem apenas uma mensagem de texto SEM mídia, retornar para o input
    const firstMessage = messages[0];
    if (
      messages.length === 1 &&
      firstMessage?.type === "text" &&
      !firstMessage.mediaUrl
    ) {
      // Processar variáveis localmente para preview
      const content = firstMessage.content
        .replace(/\{\{contact\.name\}\}/g, contactName)
        .replace(/\{\{agent\.name\}\}/g, session.user.name)
        .replace(/\{\{organization\.name\}\}/g, currentOrganization?.name ?? "");

      return content;
    }

    // Múltiplas mensagens OU com mídia: enviar via backend
    try {
      await sendQuickReplyMutation.mutateAsync({
        quickReplyId: selection.id,
        chatId,
        variables: {
          contactName,
          agentName: session.user.name,
          organizationName: currentOrganization?.name ?? "",
        },
      });

      // Tocar som de notificação
      playNotificationSound();

      // Invalidate queries para atualizar lista de chats
      void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });

      // Return null para limpar o input
      return null;
    } catch (error) {
      console.error("Failed to send quick reply:", error);
      throw error;
    }
  };

  return {
    handleQuickReplySelect,
  };
}
