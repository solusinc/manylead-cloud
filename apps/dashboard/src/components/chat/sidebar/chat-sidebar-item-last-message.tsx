"use client";

import { BanIcon, FileText, Image as ImageIcon, Video, Mic } from "lucide-react";

import { cn } from "@manylead/ui";

import type { MessageStatus } from "../message/message-status-icon";
import { MessageStatusIcon } from "../message/message-status-icon";

/**
 * Renderiza a última mensagem do chat na sidebar
 */
export function ChatSidebarItemLastMessage({
  isTyping = false,
  isRecording = false,
  lastMessageIsDeleted = false,
  messageSender: _messageSender,
  messageStatus,
  messageType = "text",
  message,
  className,
}: {
  isTyping?: boolean;
  isRecording?: boolean;
  lastMessageIsDeleted?: boolean;
  messageSender?: "agent" | "contact" | "system";
  messageStatus?: MessageStatus;
  messageType?: "text" | "image" | "video" | "audio" | "document" | "system";
  message: string;
  className?: string;
}) {
  // Caso 1: Usuário está gravando (prioridade máxima)
  if (isRecording) {
    return (
      <span className="text-primary flex-1 truncate text-sm font-semibold">
        gravando áudio...
      </span>
    );
  }

  // Caso 2: Usuário está digitando
  if (isTyping) {
    return (
      <span className="text-primary flex-1 truncate text-sm font-semibold">
        digitando...
      </span>
    );
  }

  // Caso 3: Mensagem foi deletada
  if (lastMessageIsDeleted) {
    return (
      <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}>
        <BanIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground flex-1 truncate text-sm italic">
          Esta mensagem foi excluída
        </p>
      </div>
    );
  }

  // Caso 4: Mensagem normal (texto ou mídia)
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-1.5", className)}>
      {/* Status icon - para qualquer mensagem com status */}
      {messageStatus && (
        <MessageStatusIcon status={messageStatus} size={14} className="shrink-0" />
      )}

      {/* Ícone de mídia (imagem/vídeo/documento/áudio) */}
      {messageType === "image" && (
        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {messageType === "video" && (
        <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {messageType === "document" && (
        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {messageType === "audio" && (
        <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      {/* Texto da mensagem ou label do tipo de mídia */}
      <p className="text-muted-foreground flex-1 truncate text-sm">
        {messageType === "image"
          ? "Foto"
          : messageType === "video"
          ? "Vídeo"
          : messageType === "document"
          ? "Documento"
          : messageType === "audio"
          ? "Áudio"
          : message}
      </p>
    </div>
  );
}
