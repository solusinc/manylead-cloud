"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, UserCheck } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import type { QuickReplySelection } from "./quick-reply-dropdown";
import { ChatCommentDialog } from "./chat-comment-dialog";
import { ChatInputToolbar } from "./chat-input-toolbar";
import { ChatReplyPreview } from "./chat-reply-preview";
import { QuickReplyDropdown } from "./quick-reply-dropdown";
import { useTRPC } from "~/lib/trpc/react";
import { useChatReply } from "../providers/chat-reply-provider";
import { useCurrentAgent } from "~/hooks/chat/use-current-agent";
import { useSendMessage } from "./hooks/use-send-message";
import { useInputContent } from "./hooks/use-input-content";
import { useQuickReplySelect } from "./hooks/use-quick-reply-select";

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
  const [isSending, setIsSending] = useState(false);
  const shouldFocusRef = useRef(false);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { replyingTo, cancelReply, setMediaPreview } = useChatReply();

  // Custom hooks
  const { data: currentAgent } = useCurrentAgent();
  const { sendMessage } = useSendMessage(chatId);
  const {
    content,
    handleContentChange,
    clearContent,
    rows,
    quickReplyOpen,
    quickReplySearch,
    closeQuickReply,
    textareaRef,
  } = useInputContent({ onTypingStart, onTypingStop });
  const { handleQuickReplySelect: handleQuickReplySelectHook } = useQuickReplySelect(chatId);

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

  // Auto-focus after sending
  useEffect(() => {
    if (shouldFocusRef.current && !isSending) {
      textareaRef.current?.focus();
      shouldFocusRef.current = false;
    }
  }, [isSending, textareaRef]);

  const handleSend = useCallback(() => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    // Stop typing indicator IMEDIATAMENTE antes de enviar
    onTypingStop?.();

    // Clear input and mark for focus restoration
    const messageContent = content.trim();
    clearContent();
    shouldFocusRef.current = true;

    // Send message with reply metadata if replying
    sendMessage({
      chatId,
      content: messageContent,
      metadata: replyingTo
        ? {
            repliedToMessageId: replyingTo.id,
            repliedToContent: replyingTo.content,
            repliedToSender: replyingTo.senderName,
          }
        : undefined,
    })
      .catch((error) => {
        console.error("Failed to send message:", error);
      })
      .finally(() => {
        setIsSending(false);
        cancelReply();
      });
  }, [content, isSending, onTypingStop, clearContent, sendMessage, chatId, replyingTo, cancelReply]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Se o dropdown de quick reply está aberto, não enviar com Enter
      if (quickReplyOpen) {
        if (
          e.key === "Enter" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "Escape"
        ) {
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [quickReplyOpen, handleSend]
  );

  const handleQuickReplySelect = useCallback(
    async (selection: QuickReplySelection) => {
      // Limpar o comando "/" do input
      const newContent = content.replace(/(?:^|\s)\/[\w]*$/, "").trim();
      closeQuickReply();

      setIsSending(true);

      // Stop typing indicator quando envia quick reply
      onTypingStop?.();

      try {
        const singleMessageContent = await handleQuickReplySelectHook(selection);

        if (singleMessageContent) {
          // Single message: colocar no input
          const finalContent = newContent
            ? `${newContent} ${singleMessageContent}`
            : singleMessageContent;
          handleContentChange(finalContent);
        } else {
          // Multiple messages sent: limpar o input completamente
          clearContent();
        }
      } catch (error) {
        console.error("Failed to handle quick reply:", error);
      } finally {
        setIsSending(false);
        textareaRef.current?.focus();
      }
    },
    [content, closeQuickReply, onTypingStop, handleQuickReplySelectHook, handleContentChange, clearContent, textareaRef]
  );

  const handleQuickReplyClose = useCallback(() => {
    closeQuickReply();
    textareaRef.current?.focus();
  }, [closeQuickReply, textareaRef]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      handleContentChange(content + emoji);
      textareaRef.current?.focus();
    },
    [content, handleContentChange, textareaRef]
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      setMediaPreview(file);
    },
    [setMediaPreview]
  );

  // Determina se deve usar rounded-full ou rounded-3xl (WhatsApp style)
  const isMultiLine = rows > 2;

  // Se não está atribuído, mostrar UI de "Aguardando atendimento"
  if (!assignedTo) {
    return (
      <div
        className={cn("flex flex-col items-center gap-3 bg-muted/30 py-4", className)}
        {...props}
      >
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
    const allMessages = messagesData?.pages.flatMap((page) => page.items) ?? [];
    const closedMessages = allMessages.filter(
      (item) =>
        item.message.sender === "system" &&
        (item.message.metadata as Record<string, unknown> | undefined)?.systemEventType ===
          "session_closed"
    );
    const closedMessage = closedMessages[closedMessages.length - 1];

    const closedMetadata = closedMessage?.message.metadata as
      | Record<string, string>
      | undefined;
    const closedBy = closedMetadata?.agentName ?? "Agente";
    const closedAt = closedMetadata?.closedAt ?? new Date().toISOString();
    const closedDate = new Date(closedAt);
    const formattedClosedAt = `${closedDate.toLocaleDateString("pt-BR")} às ${closedDate.toLocaleTimeString("pt-BR")}`;

    return (
      <div
        className={cn(
          "flex w-[calc(100%+2rem)] flex-col items-center gap-3 border-t bg-muted/30 py-4 -mx-4 -mb-2",
          className
        )}
        {...props}
      >
        <p className="text-sm text-muted-foreground">
          Atendimento finalizado por <span className="font-bold">{closedBy}</span>{" "}
          {formattedClosedAt}
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
      <div
        className={cn(
          "flex w-[calc(100%+2rem)] flex-col items-center gap-3 border-t bg-muted/30 py-4 -mx-4 -mt-4 -mb-2",
          className
        )}
        {...props}
      >
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
      {/* Quick Reply dropdown */}
      <QuickReplyDropdown
        searchTerm={quickReplySearch}
        onSelect={handleQuickReplySelect}
        onClose={handleQuickReplyClose}
        isOpen={quickReplyOpen}
      />

      {/* Reply preview */}
      <ChatReplyPreview
        repliedMessage={
          replyingTo
            ? {
                id: replyingTo.id,
                content: replyingTo.content,
                senderName: replyingTo.senderName,
              }
            : null
        }
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
          <ChatInputToolbar chatId={chatId} onEmojiSelect={insertEmoji} onFileSelect={handleFileSelect} />

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
        className
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
        className
      )}
      aria-label="Voice message"
      {...props}
    >
      <Mic className="size-5" />
    </Button>
  );
}
