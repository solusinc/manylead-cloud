"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

import { ChatInputToolbar } from "./chat-input-toolbar";

export function ChatInput({
  chatId,
  className,
  ...props
}: {
  chatId: string;
} & React.ComponentProps<"div">) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!content.trim() || isSending) return;

    setIsSending(true);

    // TODO: Implement send message mutation
    console.log("Sending message:", content, "to chat:", chatId);

    // Clear input
    setContent("");
    textareaRef.current?.focus();
    setIsSending(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="flex items-end gap-2">
        <ChatInputToolbar onEmojiSelect={insertEmoji} />

        <ChatInputArea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />

        <ChatInputSendButton
          onClick={handleSend}
          disabled={!content.trim() || isSending}
          isLoading={isSending}
        />
      </div>

      <ChatInputHint />
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
      placeholder="Digite uma mensagem..."
      className={cn(
        "border-input bg-background flex-1 resize-none rounded-md border px-3 py-2",
        "placeholder:text-muted-foreground text-sm",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "max-h-[200px] min-h-11",
        className,
      )}
      minRows={1}
      maxRows={8}
      {...props}
    />
  );
};

export function ChatInputSendButton({
  onClick,
  disabled,
  isLoading,
  className,
  ...props
}: {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className={cn("h-11 w-111 shrink-0", className)}
      aria-label="Send message"
      {...props}
    >
      {isLoading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <Send className="h-4 w-4" />
      )}
    </Button>
  );
}

export function ChatInputHint({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-xs", className)} {...props}>
      Pressione Cmd/Ctrl + Enter para enviar
    </p>
  );
}
