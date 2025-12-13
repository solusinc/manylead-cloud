"use client";

import { useEffect } from "react";
import { X, Image as ImageIcon, Video, Mic, FileText, User } from "lucide-react";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";

interface ChatReplyPreviewProps {
  repliedMessage: {
    id: string;
    content: string;
    senderName: string;
    messageType?: "text" | "image" | "video" | "audio" | "document" | "contact";
  } | null;
  onCancel: () => void;
  className?: string;
}

export function ChatReplyPreview({
  repliedMessage,
  onCancel,
  className,
}: ChatReplyPreviewProps) {
  // Adicionar listener para ESC cancelar o reply
  useEffect(() => {
    if (!repliedMessage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [repliedMessage, onCancel]);

  if (!repliedMessage) return null;

  const messageType = repliedMessage.messageType ?? "text";
  const isMedia = messageType !== "text";

  // Remover assinatura **Nome**\n do conteúdo
  const cleanContent = repliedMessage.content.replace(/^\*\*.*?\*\*\n/, "");

  // Truncar conteúdo se for muito longo
  const truncatedContent = cleanContent.length > 50
    ? `${cleanContent.substring(0, 50)}...`
    : cleanContent;

  // Map de ícones e labels para cada tipo de mídia
  const mediaConfig: Record<string, { icon: typeof ImageIcon; label: string }> = {
    image: { icon: ImageIcon, label: truncatedContent || "Foto" },
    video: { icon: Video, label: truncatedContent || "Vídeo" },
    audio: { icon: Mic, label: "Áudio" },
    document: { icon: FileText, label: truncatedContent || "Documento" },
    contact: { icon: User, label: truncatedContent || "Contato" },
  };

  const mediaInfo = isMedia && messageType in mediaConfig
    ? mediaConfig[messageType]
    : null;

  const MediaIcon = mediaInfo?.icon ?? null;
  const mediaLabel = mediaInfo?.label ?? null;

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
        {isMedia ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {MediaIcon && <MediaIcon className="h-4 w-4" />}
            <span>{mediaLabel}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground truncate">
            {truncatedContent}
          </p>
        )}
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
