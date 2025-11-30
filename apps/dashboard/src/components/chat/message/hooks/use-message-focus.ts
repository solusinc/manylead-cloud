import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageFocusStore } from "~/stores/use-message-focus-store";

export function useMessageFocus(chatId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { focusMessageId, focusChatId, clearFocus } = useMessageFocusStore();
  const shouldFocusMessage = focusChatId === chatId && focusMessageId !== null;

  // Query para buscar mensagens ao redor
  const { data: contextData } = useQuery({
    ...trpc.messages.getContext.queryOptions({
      chatId,
      messageId: focusMessageId ?? "",
      before: 30,
      after: 30,
    }),
    enabled: shouldFocusMessage,
  });

  // Processar foco
  useEffect(() => {
    if (!shouldFocusMessage || !focusMessageId) return;

    const scrollAndHighlight = (messageId: string) => {
      setTimeout(() => {
        const messageElement = document.querySelector(
          `[data-message-id="${messageId}"]`
        );
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: "instant",
            block: "center",
          });
          messageElement.classList.add("reply-highlight");
          setTimeout(() => {
            messageElement.classList.remove("reply-highlight");
          }, 2000);
        }
        clearFocus();
      }, 100);
    };

    // Check if already in DOM
    const existingElement = document.querySelector(
      `[data-message-id="${focusMessageId}"]`
    );
    if (existingElement) {
      scrollAndHighlight(focusMessageId);
      return;
    }

    // Update cache with context data
    if (contextData?.items && contextData.items.length > 0) {
      const contextPage = {
        items: contextData.items,
        nextCursor: contextData.hasMoreBefore
          ? contextData.items[0]?.message.id
          : undefined,
        hasMore: contextData.hasMoreBefore,
      };

      const queryKey = trpc.messages.list.infiniteQueryKey({
        chatId,
        firstPageLimit: 50,
        limit: 30,
      });
      queryClient.setQueryData(queryKey, {
        pages: [contextPage],
        pageParams: [null],
      });

      scrollAndHighlight(focusMessageId);
    }
  }, [
    shouldFocusMessage,
    focusMessageId,
    contextData,
    clearFocus,
    queryClient,
    trpc,
    chatId,
  ]);
}
