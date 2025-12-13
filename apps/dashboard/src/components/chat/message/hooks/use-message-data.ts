import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import type { Message, Attachment } from "@manylead/db";

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 30;

export interface MessageWithSender extends Omit<Message, "sender"> {
  sender: "contact" | "agent" | "system";
  attachment?: Attachment;
  isOwnMessage?: boolean; // Se a mensagem é do agente logado
}

export interface UseMessageDataReturn {
  messages: MessageWithSender[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
}

export function useMessageData(chatId: string): UseMessageDataReturn {
  const trpc = useTRPC();

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      ...trpc.messages.list.infiniteQueryOptions({
        chatId,
        firstPageLimit: INITIAL_LIMIT,
        limit: LOAD_MORE_LIMIT,
      }),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: Infinity,
      gcTime: Infinity,
    });

  // Flatten and transform messages
  const messages = useMemo(() => {
    const pages = data?.pages ?? [];
    return [...pages]
      .reverse()
      .flatMap((page) => page.items)
      .map((item): MessageWithSender => ({
        ...item.message,
        sender: item.message.sender as "contact" | "agent" | "system", // Preservar sender original
        attachment: item.attachment ?? undefined,
        isOwnMessage: item.isOwnMessage, // Adicionar flag de mensagem própria
      }));
  }, [data?.pages]);

  return {
    messages,
    isLoading,
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
    hasNextPage: Boolean(hasNextPage),
  };
}
