"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";
import { useNotificationSound } from "~/hooks/use-notification-sound";

interface SendMessageOptions {
  chatId: string;
  content: string;
  metadata?: {
    repliedToMessageId: string;
    repliedToContent: string;
    repliedToSender: string;
    repliedToMessageType?: string;
  };
}

/**
 * Hook for sending messages with optimistic updates and cache management
 * Extracted from chat-input.tsx (lines 185-402)
 *
 * IMPORTANT: Routes messages to correct endpoint based on messageSource:
 * - "whatsapp" → sendWhatsApp (Evolution API via WhatsAppMessageService)
 * - "internal" → sendText (cross-org via InternalMessageService)
 */
export function useSendMessage(
  chatId: string,
  messageSource: "whatsapp" | "internal",
  chatCreatedAt?: Date
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();
  const { playNotificationSound } = useNotificationSound();

  // Mutation for WhatsApp messages (with optimistic UI)
  const sendWhatsAppMutation = useMutation(
    trpc.messages.sendWhatsApp.mutationOptions({
      onSuccess: (serverMessage, variables) => {
        const tempId = variables.tempId;

        if (tempId) {
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

            // MERGE: manter campos do tempMessage + atualizar com serverMessage
            const newPages = queryState.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.message.id === tempId
                  ? {
                      ...item,
                      message: {
                        ...item.message, // Manter content, senderName, etc
                        ...serverMessage, // Sobrescrever id, status, timestamp
                        _isOptimistic: false,
                      } as unknown as Record<string, unknown>,
                    }
                  : item
              ),
            }));

            queryClient.setQueryData(query.queryKey, {
              ...queryState,
              pages: newPages,
              pageParams: queryState.pageParams,
            });

            void queryClient.invalidateQueries({
              queryKey: query.queryKey,
              refetchType: "none",
            });
          });
        }

        register(serverMessage.id);

        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });

        playNotificationSound();
      },
      onError: (error, variables) => {
        const tempId = variables.tempId;

        if (tempId) {
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

            // Marcar como failed ao invés de remover
            const newPages = queryState.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.message.id === tempId
                  ? { ...item, message: { ...item.message, status: "failed", _isOptimistic: false } }
                  : item
              ),
            }));

            queryClient.setQueryData(query.queryKey, {
              ...queryState,
              pages: newPages,
              pageParams: queryState.pageParams,
            });
          });
        }

        toast.error("Erro ao enviar mensagem WhatsApp", {
          description: error.message,
        });
      },
    })
  );

  // Mutation for internal messages
  const sendInternalMutation = useMutation(
    trpc.messages.sendText.mutationOptions({
      onSuccess: (serverMessage, variables) => {
        // HYBRID APPROACH: Replace tempId with serverId
        const tempId = variables.tempId;

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

          // REPLACE tempId with serverId in cache
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.message.id === tempId
                ? {
                    ...item,
                    message: {
                      ...serverMessage,
                      _isOptimistic: false,
                    } as unknown as Record<string, unknown>,
                  }
                : item
            ),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });

          // Force re-render
          void queryClient.invalidateQueries({
            queryKey: query.queryKey,
            refetchType: "none",
          });
        });

        // Register serverId in dedup store
        register(serverMessage.id);

        // Invalidate chats list
        void queryClient.invalidateQueries({
          queryKey: [["chats", "list"]],
        });

        // Play notification sound
        playNotificationSound();
      },
      onError: (error, variables) => {
        const tempId = variables.tempId;

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

          // Marcar como failed ao invés de remover
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.message.id === tempId
                ? { ...item, message: { ...item.message, status: "failed", _isOptimistic: false } }
                : item
            ),
          }));

          queryClient.setQueryData(query.queryKey, {
            ...queryState,
            pages: newPages,
            pageParams: queryState.pageParams,
          });
        });

        toast.error("Erro ao enviar mensagem", {
          description: error.message,
        });
      },
    })
  );

  /**
   * Send a single message
   * Both WhatsApp and Internal use optimistic UI with tempId
   */
  const sendMessage = async (options: SendMessageOptions) => {
    const { content, metadata } = options;

    if (messageSource === "whatsapp") {
      if (!chatCreatedAt) {
        throw new Error("chatCreatedAt is required for WhatsApp messages");
      }

      // Optimistic UI: criar tempMessage igual ao internal
      const tempId = uuidv7();
      const userName = session.user.name;

      const tempMessage = {
        id: tempId,
        chatId,
        content,
        senderName: userName,
        timestamp: new Date(),
        status: "pending" as const,
        sender: "agent" as const,
        senderId: null as string | null,
        messageType: "text" as const,
        isOwnMessage: true,
        _isOptimistic: true,
        repliedToMessageId: metadata?.repliedToMessageId ?? null,
        metadata: metadata ?? null,
      };

      // Adicionar ao cache ANTES da mutation
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

      await sendWhatsAppMutation.mutateAsync({
        chatId,
        createdAt: chatCreatedAt,
        content,
        tempId,
        repliedToMessageId: metadata?.repliedToMessageId,
        metadata,
      });
    } else {
      // Internal: Use optimistic UI with tempId
      const tempId = uuidv7();
      const userName = session.user.name;

      const tempMessage = {
        id: tempId,
        chatId,
        content,
        senderName: userName,
        timestamp: new Date(),
        status: "pending" as const,
        sender: "agent" as const,
        senderId: null as string | null,
        messageType: "text" as const,
        isOwnMessage: true,
        _isOptimistic: true,
        repliedToMessageId: metadata?.repliedToMessageId ?? null,
        metadata: metadata ?? null,
      };

      // Add to cache BEFORE mutateAsync (instant UI update)
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

      // Register tempId in dedup store
      register(tempId);

      await sendInternalMutation.mutateAsync({
        chatId,
        content,
        tempId,
        metadata,
      });
    }
  };

  return {
    sendMessage,
    isSending: sendWhatsAppMutation.isPending || sendInternalMutation.isPending,
  };
}
