"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, MessageSquare, UserCheck } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import { ChatInputToolbar } from "./chat-input-toolbar";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";

export function ChatInput({
  chatId,
  chatCreatedAt,
  chatStatus,
  assignedTo,
  onTypingStart,
  onTypingStop,
  className,
  ...props
}: {
  chatId: string;
  chatCreatedAt: Date;
  chatStatus: "open" | "closed";
  assignedTo: string | null;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
} & React.ComponentProps<"div">) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [rows, setRows] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldFocusRef = useRef(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();

  // Buscar agent atual para pegar ID ao atribuir
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );

  // Mutation para atribuir chat ao agent atual
  const assignMutation = useMutation(
    trpc.chats.assign.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });
        toast.success("Chat atribuído com sucesso!");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao atribuir chat");
      },
    })
  );

  const handleAtender = () => {
    if (!currentAgent?.id) {
      toast.error("Erro ao identificar agent");
      return;
    }

    assignMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
      agentId: currentAgent.id,
    });
  };

  // PROFESSIONAL: Auto-focus after sending (runs after all React updates)
  useEffect(() => {
    if (shouldFocusRef.current && !isSending) {
      textareaRef.current?.focus();
      shouldFocusRef.current = false;
    }
  }, [isSending]);

  // Mutation para enviar mensagem de texto
  const sendMessageMutation = useMutation(
    trpc.messages.sendText.mutationOptions({
      onSuccess: (serverMessage, variables) => {
        // HYBRID APPROACH: Replace tempId with serverId
        // tempId is in variables.tempId, serverId is in serverMessage.id

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
      },
      onError: (error, variables) => {
        // REMOVE optimistic message on error
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

          // Remove optimistic message
          const newPages = queryState.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.message.id !== tempId),
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

  const handleSend = () => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    // Stop typing indicator
    if (isTyping) {
      onTypingStop?.();
      setIsTyping(false);
    }

    // === TRUE OPTIMISTIC UPDATE ===
    // 1. Generate tempId BEFORE sending (UUIDv7 - time-sortable)
    const tempId = uuidv7();

    // Format message with signature: **UserName**\nContent (same as backend)
    const userName = session.user.name;
    const formattedContent = `**${userName}**\n${content.trim()}`;

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

    // 2. Add to cache BEFORE mutateAsync (instant UI update)
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

    // 3. Register tempId in dedup store
    register(tempId);

    // Clear input BEFORE sending (instant feedback)
    const messageContent = content.trim();
    setContent("");
    setRows(1);

    // Mark that we need to restore focus after sending completes
    shouldFocusRef.current = true;

    // 4. Send to server (with tempId) - NO AWAIT, fire and forget
    sendMessageMutation.mutateAsync({
      chatId,
      content: messageContent,
      tempId,
    }).catch((error) => {
      console.error("Failed to send message:", error);
    }).finally(() => {
      setIsSending(false);
      // useEffect will handle focus restoration when isSending becomes false
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);

    // Detectar número de linhas VISUAIS (não apenas \n)
    // Usa requestAnimationFrame para garantir que o textarea já foi renderizado
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const lineHeight = 24; // altura de uma linha em pixels (aproximado)
        const scrollHeight = textareaRef.current.scrollHeight;
        const calculatedRows = Math.ceil(scrollHeight / lineHeight);
        setRows(calculatedRows);
      }
    });

    // Typing indicator logic
    if (value.trim() && !isTyping) {
      onTypingStart?.();
      setIsTyping(true);
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          onTypingStop?.();
          setIsTyping(false);
        }
      }, 3000);
    } else if (isTyping) {
      onTypingStop?.();
      setIsTyping(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    handleContentChange(content + emoji);
    textareaRef.current?.focus();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        onTypingStop?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determina se deve usar rounded-full ou rounded-3xl (WhatsApp style)
  // Só muda após 2 linhas (quando vai para a 3ª linha)
  const isMultiLine = rows > 2;

  // Se não está atribuído, mostrar UI de "Aguardando atendimento"
  if (!assignedTo) {
    return (
      <div className={cn("flex w-full flex-col items-center gap-3 rounded-lg border bg-muted/30 py-4", className)} {...props}>
        <p className="text-sm text-muted-foreground">Aguardando atendimento</p>
        <div className="flex gap-2">
          <Button variant="outline" size="default">
            <MessageSquare className="mr-2 h-4 w-4" />
            Comentário
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={handleAtender}
            disabled={assignMutation.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            {assignMutation.isPending ? "Atribuindo..." : "Atender"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full items-end", className)} {...props}>
      <div
        className={cn(
          "border-input bg-background flex flex-1 items-center gap-1 border px-2 transition-all",
          isMultiLine ? "rounded-3xl" : "rounded-full"
        )}
      >
        <ChatInputToolbar onEmojiSelect={insertEmoji} />

        <ChatInputArea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          autoFocus
        />

        <ChatInputMicButton />
      </div>
    </div>
  );
}

export const ChatInputArea = ({
  value,
  onChange,
  onKeyDown,
  disabled,
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TextareaAutosize> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) => {
  return (
    <TextareaAutosize
      ref={ref}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      disabled={disabled}
      placeholder="Digite uma mensagem"
      className={cn(
        "flex-1 resize-none border-0 bg-transparent px-3 py-2.5",
        "placeholder:text-muted-foreground text-sm",
        "focus-visible:ring-0 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "max-h-[200px] min-h-11",
        className,
      )}
      minRows={1}
      maxRows={8}
      style={{ height: 44 }}
      {...props}
    />
  );
};

export function ChatInputMicButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "text-muted-foreground hover:text-foreground h-9 w-9 shrink-0 rounded-full",
        className,
      )}
      aria-label="Voice message"
      {...props}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
