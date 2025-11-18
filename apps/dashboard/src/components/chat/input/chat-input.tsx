"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import { ChatInputToolbar } from "./chat-input-toolbar";
import { useTRPC } from "~/lib/trpc/react";

export function ChatInput({
  chatId,
  onTypingStart,
  onTypingStop,
  className,
  ...props
}: {
  chatId: string;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
} & React.ComponentProps<"div">) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [rows, setRows] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Mutation para enviar mensagem de texto
  const sendMessageMutation = useMutation(
    trpc.messages.sendText.mutationOptions({
      onSuccess: () => {
        // Invalidar queries para atualizar a lista de mensagens e chats
        void queryClient.invalidateQueries({
          queryKey: [["messages"]],
        });
        void queryClient.invalidateQueries({
          queryKey: [["chats"]],
        });
      },
      onError: (error) => {
        toast.error("Erro ao enviar mensagem", {
          description: error.message,
        });
      },
    })
  );

  const handleSend = async () => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    // Stop typing indicator
    if (isTyping) {
      console.log("[ChatInput] Calling onTypingStop (send)");
      onTypingStop?.();
      setIsTyping(false);
    }

    try {
      await sendMessageMutation.mutateAsync({
        chatId,
        content: content.trim(),
      });

      // Clear input
      setContent("");
      setRows(1); // Reset para 1 linha
      textareaRef.current?.focus();
    } catch (error) {
      // Error already handled by onError
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
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
      // Start typing
      console.log("[ChatInput] Calling onTypingStart");
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
          console.log("[ChatInput] Calling onTypingStop (timeout)");
          onTypingStop?.();
          setIsTyping(false);
        }
      }, 3000);
    } else if (isTyping) {
      // Stop typing if input is empty
      console.log("[ChatInput] Calling onTypingStop (empty)");
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
