"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, UserCheck } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import type { QuickReplySelection } from "./quick-reply-dropdown";
import { ChatCommentDialog } from "./chat-comment-dialog";
import { ChatInputToolbar } from "./chat-input-toolbar";
import { ChatReplyPreview } from "./chat-reply-preview";
import { QuickReplyDropdown } from "./quick-reply-dropdown";
import { useTRPC } from "~/lib/trpc/react";
import { useMessageDeduplication } from "~/hooks/use-message-deduplication";
import { useServerSession } from "~/components/providers/session-provider";
import { useChatReply } from "../providers/chat-reply-provider";

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
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldFocusRef = useRef(false);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { register } = useMessageDeduplication();
  const session = useServerSession();
  const { replyingTo, cancelReply } = useChatReply();

  // Buscar agent atual para pegar ID ao atribuir
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );

  // Buscar informações do agent assigned (se houver)
  const { data: assignedAgent } = useQuery({
    ...trpc.agents.getById.queryOptions({ id: assignedTo ?? "" }),
    enabled: !!assignedTo,
  });

  // Buscar mensagens para pegar info de fechamento (se chat estiver fechado)
  const { data: messagesData } = useInfiniteQuery({
    ...trpc.messages.list.infiniteQueryOptions({
      chatId,
      firstPageLimit: 50,
      limit: 50,
    }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: chatStatus === "closed",
  });

  // Buscar chat atual para criar nova sessão
  const { data: currentChat } = useQuery({
    ...trpc.chats.getById.queryOptions({ id: chatId, createdAt: chatCreatedAt }),
    enabled: chatStatus === "closed",
  });

  // Mutation para marcar chat como lido
  const markAsReadMutation = useMutation(trpc.chats.markAsRead.mutationOptions());

  // Mutation para marcar todas as mensagens como lidas
  const markAllMessagesAsReadMutation = useMutation(
    trpc.messages.markAllAsRead.mutationOptions()
  );

  // Mutation para atribuir chat ao agent atual
  const assignMutation = useMutation(
    trpc.chats.assign.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });

        // Marcar chat como lido após pegar atendimento
        markAsReadMutation.mutate({
          id: chatId,
          createdAt: chatCreatedAt,
        });

        // Marcar todas as mensagens como lidas
        markAllMessagesAsReadMutation.mutate({
          chatId,
        });
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

  // Mutation para criar nova sessão (chat interno)
  const createNewSessionMutation = useMutation(
    trpc.chats.createNewSession.mutationOptions({
      onSuccess: (chat) => {
        void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });
        toast.success("Nova sessão criada");
        // Navegar para o novo chat
        router.push(`/chats/${chat.id}`);
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao criar nova sessão");
      },
    })
  );

  const handleNovoAtendimento = () => {
    if (!currentChat) {
      toast.error("Erro ao carregar dados do chat");
      return;
    }

    if (!currentAgent?.id) {
      toast.error("Erro ao identificar agent");
      return;
    }

    // Se for chat interno, criar nova sessão com a organização
    if (currentChat.chat.messageSource === "internal") {
      // Contact representa a outra organização
      const targetOrgInstanceCode = currentChat.contact?.metadata?.targetOrganizationInstanceCode;

      if (!targetOrgInstanceCode) {
        toast.error("Erro ao identificar organização");
        return;
      }

      createNewSessionMutation.mutate({
        organizationInstanceCode: targetOrgInstanceCode,
      });
    } else {
      // WhatsApp - TODO: implementar criação de nova sessão WhatsApp
      toast("Em breve", {
        description: "Criação de nova sessão WhatsApp será implementada em breve.",
      });
    }
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

    // 4. Send to server (with tempId and repliedToMessageId) - NO AWAIT, fire and forget
    sendMessageMutation.mutateAsync({
      chatId,
      content: messageContent,
      tempId,
      metadata: replyingTo ? {
        repliedToMessageId: replyingTo.id,
        repliedToContent: replyingTo.content,
        repliedToSender: replyingTo.senderName,
      } : undefined,
    }).catch((error) => {
      console.error("Failed to send message:", error);
    }).finally(() => {
      setIsSending(false);
      cancelReply(); // Limpar reply após enviar
      // useEffect will handle focus restoration when isSending becomes false
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Se o dropdown de quick reply está aberto, não enviar com Enter
    // (a navegação é tratada pelo dropdown)
    if (quickReplyOpen) {
      if (e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Escape") {
        // Deixar o dropdown tratar esses eventos
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleContentChange = (value: string) => {
    setContent(value);

    // Detectar "/" para quick reply
    // Ativar quando: "/" está no início ou após um espaço/quebra de linha
    const slashRegex = /(?:^|\s)\/([\w]*)$/;
    const slashMatch = slashRegex.exec(value);
    if (slashMatch) {
      const searchTerm = slashMatch[1] ?? "";
      setQuickReplySearch(searchTerm);
      setQuickReplyOpen(true);
    } else {
      setQuickReplyOpen(false);
      setQuickReplySearch("");
    }

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

  const handleQuickReplySelect = async (selection: QuickReplySelection) => {
    // Limpar o comando "/" do input
    const newContent = content.replace(/(?:^|\s)\/[\w]*$/, "").trim();
    setContent(newContent);
    setQuickReplyOpen(false);
    setQuickReplySearch("");

    // Filtrar apenas mensagens de texto (por enquanto)
    const textMessages = selection.messages.filter((m) => m.type === "text");

    if (textMessages.length === 0) {
      textareaRef.current?.focus();
      return;
    }

    // Se tem apenas uma mensagem, colocar no input para o usuário enviar
    if (textMessages.length === 1) {
      const firstMessage = textMessages[0];
      if (firstMessage) {
        const singleContent = newContent
          ? `${newContent} ${firstMessage.content}`
          : firstMessage.content;
        setContent(singleContent);
      }
      textareaRef.current?.focus();
      return;
    }

    // Múltiplas mensagens: enviar em sequência
    setIsSending(true);

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
        await sendMessageMutation.mutateAsync({
          chatId,
          content: message.content,
          tempId,
        });
      } catch (error) {
        console.error("Failed to send quick reply message:", error);
      }

      // Pequeno delay entre mensagens para não sobrecarregar
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setIsSending(false);
    void queryClient.invalidateQueries({ queryKey: [["chats", "list"]] });
    textareaRef.current?.focus();
  };

  const handleQuickReplyClose = () => {
    setQuickReplyOpen(false);
    setQuickReplySearch("");
    textareaRef.current?.focus();
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
      <div className={cn("flex flex-col items-center gap-3 bg-muted/30 py-4", className)} {...props}>
        <p className="text-sm text-muted-foreground">Aguardando atendimento</p>
        <div className="flex gap-2">
          <ChatCommentDialog chatId={chatId} />
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

  // Se o chat está fechado, mostrar "Atendimento finalizado por..."
  if (chatStatus === "closed") {
    // Buscar ÚLTIMA mensagem de sistema de fechamento (em caso de reaberturas)
    const allMessages = messagesData?.pages.flatMap((page) => page.items) ?? [];
    const closedMessages = allMessages.filter(
      (item) =>
        item.message.sender === "system" &&
        (item.message.metadata as Record<string, unknown> | undefined)?.systemEventType === "session_closed"
    );
    const closedMessage = closedMessages[closedMessages.length - 1];

    const closedMetadata = closedMessage?.message.metadata as Record<string, string> | undefined;
    const closedBy = closedMetadata?.agentName ?? "Agente";
    const closedAt = closedMetadata?.closedAt ?? new Date().toISOString();
    const closedDate = new Date(closedAt);
    const formattedClosedAt = `${closedDate.toLocaleDateString("pt-BR")} às ${closedDate.toLocaleTimeString("pt-BR")}`;

    return (
      <div className={cn("flex w-[calc(100%+2rem)] flex-col items-center gap-3 border-t bg-muted/30 py-4 -mx-4 -mb-2", className)} {...props}>
        <p className="text-sm text-muted-foreground">
          Atendimento finalizado por <span className="font-bold">{closedBy}</span> {formattedClosedAt}
        </p>
        <div className="flex gap-2">
          <ChatCommentDialog chatId={chatId} />
          <Button
            variant="default"
            size="default"
            onClick={handleNovoAtendimento}
            disabled={createNewSessionMutation.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            {createNewSessionMutation.isPending ? "Criando..." : "Novo atendimento"}
          </Button>
        </div>
      </div>
    );
  }

  // Se está atribuído para outro agent, mostrar "Em atendimento com..."
  if (assignedTo && assignedTo !== currentAgent?.id) {
    return (
      <div className={cn("flex w-[calc(100%+2rem)] flex-col items-center gap-3 border-t bg-muted/30 py-4 -mx-4 -mt-4 -mb-2", className)} {...props}>
        <p className="text-sm text-muted-foreground">
          Em atendimento com <span className="font-bold">{assignedAgent?.user?.name ?? "..."}</span>
        </p>
        <div className="flex gap-2">
          <ChatCommentDialog chatId={chatId} />
          <Button
            variant="default"
            size="default"
            onClick={handleAtender}
            disabled={assignMutation.isPending}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            {assignMutation.isPending ? "Pegando..." : "Pegar atendimento"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex w-full flex-col gap-2", className)} {...props}>
      {/* Quick Reply dropdown - aparece acima do input quando digita "/" */}
      <QuickReplyDropdown
        searchTerm={quickReplySearch}
        onSelect={handleQuickReplySelect}
        onClose={handleQuickReplyClose}
        isOpen={quickReplyOpen}
      />

      {/* Reply preview - aparece acima do input quando está respondendo */}
      <ChatReplyPreview
        repliedMessage={replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderName: replyingTo.senderName,
        } : null}
        onCancel={cancelReply}
      />

      {/* Input area */}
      <div className="flex w-full items-end">
        <div
          className={cn(
            "border-input bg-background flex flex-1 items-center gap-1 border px-2 transition-all",
            isMultiLine ? "rounded-3xl" : "rounded-full"
          )}
        >
          <ChatInputToolbar chatId={chatId} onEmojiSelect={insertEmoji} />

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
      <Mic className="size-5" />
    </Button>
  );
}
