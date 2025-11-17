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
    <div className={cn("flex items-end w-full", className)} {...props}>
      <div className="border-input bg-background flex items-center gap-1 rounded-full border px-2 flex-1">
        <ChatInputToolbar onEmojiSelect={insertEmoji} />

        <ChatInputArea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
        "bg-transparent flex-1 resize-none border-0 px-3 py-2.5",
        "placeholder:text-muted-foreground text-sm",
        "focus-visible:outline-none focus-visible:ring-0",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-[44px] max-h-[200px]",
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
      className={cn("h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground", className)}
      aria-label="Voice message"
      {...props}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
