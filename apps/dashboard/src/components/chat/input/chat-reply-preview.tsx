"use client";

import { X } from "lucide-react";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

interface ChatReplyPreviewProps {
  repliedMessage: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  onCancel: () => void;
  className?: string;
}

export function ChatReplyPreview({
  repliedMessage,
  onCancel,
  className,
}: ChatReplyPreviewProps) {
  if (!repliedMessage) return null;

  // Remover assinatura **Nome**\n do conteúdo
  const cleanContent = repliedMessage.content.replace(/^\*\*.*?\*\*\n/, "");

  // Truncar conteúdo se for muito longo
  const truncatedContent = cleanContent.length > 50
    ? `${cleanContent.substring(0, 50)}...`
    : cleanContent;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-l-4 border-primary bg-muted/50 px-4 py-2 rounded-md",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary">
          {repliedMessage.senderName}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {truncatedContent}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-6 w-6 shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
