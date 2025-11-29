"use client";

import { useQueryClient } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";

import type { QuickReplySelection } from "../quick-reply-dropdown";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";
import { useSendMessage } from "./use-send-message";

/**
 * Handles quick reply selection and sending multiple messages in sequence
 * Extracted from chat-input.tsx (lines 472-586)
 */
export function useQuickReplySelect(chatId: string) {
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();
  const { sendMessage } = useSendMessage(chatId);

  /**
   * Handle quick reply selection
   * - Single message: Returns content to be placed in input
   * - Multiple messages: Sends all messages in sequence
   */
  const handleQuickReplySelect = async (selection: QuickReplySelection): Promise<string | null> => {
    // Filtrar apenas mensagens de texto (por enquanto)
    const textMessages = selection.messages.filter((m) => m.type === "text");

    if (textMessages.length === 0) {
      return null;
    }

    // Se tem apenas uma mensagem, retornar conteúdo para o input
    if (textMessages.length === 1) {
      const firstMessage = textMessages[0];
      return firstMessage?.content ?? null;
    }

    // Múltiplas mensagens: enviar em sequência
    for (const message of textMessages) {
      const tempId = uuidv7();
      const userName = session.user.name;
      const formattedContent = `**${userName}**\n${message.content}`;

      // Optimistic update
      const tempMessage = {
        id: tempId,
        chatId,
        content: formattedContent,
        timestamp: new Date(),
        status: "pending" as const,
        sender: "agent" as const,
        senderId: null as string | null,
        messageType: "text" as const,
        isOwnMessage: true,
        _isOptimistic: true,
      };

      const queries = queryClient.getQueryCache().findAll({
        queryKey: [["messages", "list"]],
        exact: false,
      });

      queries.forEach((query) => {
        const queryState = query.state.data as {
          pages: {
            items: {
              message: Record<string, unknown>;
              attachment: Record<string, unknown> | null;
              isOwnMessage: boolean;
            }[];
            nextCursor: string | undefined;
            hasMore: boolean;
          }[];
          pageParams: unknown[];
        } | undefined;

        if (!queryState?.pages) return;

        const newPages = [...queryState.pages];
        const firstPage = newPages[0];

        if (firstPage) {
          newPages[0] = {
            ...firstPage,
            items: [
              ...firstPage.items,
              {
                message: tempMessage as unknown as Record<string, unknown>,
                attachment: null,
                isOwnMessage: true,
              },
            ],
          };

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });
        }
      });

      register(tempId);

      try {
        await sendMessage({
          chatId,
          content: message.content,
        });
      } catch (error) {
        console.error("Failed to send quick reply message:", error);
      }

      // Pequeno delay entre mensagens para não sobrecarregar
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Invalidate chats list after sending multiple messages
    void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });

    // Return null to clear input (multiple messages were sent)
    return null;
  };

  return {
    handleQuickReplySelect,
  };
}
