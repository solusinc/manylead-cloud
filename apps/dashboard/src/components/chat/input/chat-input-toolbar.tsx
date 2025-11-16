"use client";

import type { EmojiClickData } from "emoji-picker-react";
import { useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { Paperclip, Smile } from "lucide-react";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@manylead/ui/popover";

export function ChatInputToolbar({
  onEmojiSelect,
  onFileSelect,
  className,
  ...props
}: {
  onEmojiSelect?: (emoji: string) => void;
  onFileSelect?: (file: File) => void;
} & React.ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      <ChatInputEmojiButton onEmojiSelect={onEmojiSelect} />
      <ChatInputAttachButton onFileSelect={onFileSelect} />
    </div>
  );
}

export function ChatInputEmojiButton({
  onEmojiSelect,
  className,
  ...props
}: {
  onEmojiSelect?: (emoji: string) => void;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect?.(emojiData.emoji);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-11 w-11 shrink-0", className)}
          aria-label="Add emoji"
          {...props}
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full border-0 p-0" side="top" align="start">
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          width="100%"
          height={400}
          previewConfig={{ showPreview: false }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ChatInputAttachButton({
  onFileSelect,
  className,
  ...props
}: {
  onFileSelect?: (file: File) => void;
} & React.ComponentProps<typeof Button>) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect?.(file);
    }
  };

  return (
    <>
      <input
        type="file"
        id="chat-file-upload"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
      />
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-11 w-11 shrink-0", className)}
        aria-label="Attach file"
        onClick={() => document.getElementById("chat-file-upload")?.click()}
        {...props}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    </>
  );
}
