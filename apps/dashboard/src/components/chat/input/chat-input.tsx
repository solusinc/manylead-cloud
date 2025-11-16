"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { Mic } from "lucide-react";
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className={cn("flex items-center gap-2 w-full", className)} {...props}>
      <ChatInputToolbar onEmojiSelect={insertEmoji} />

      <ChatInputArea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSending}
      />

      <ChatInputMicButton />
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
        "focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "max-h-[200px] h-11",
        className,
      )}
      minRows={1}
      maxRows={8}
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
      className={cn("h-11 w-11 shrink-0", className)}
      aria-label="Voice message"
      {...props}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
