"use client";

import { BanIcon, FileText, Image as ImageIcon, Video, Mic, User } from "lucide-react";

import { cn } from "@manylead/ui";

import type { MessageStatus } from "../message/message-status-icon";
import { MessageStatusIcon } from "../message/message-status-icon";

/**
 * Remove formatação markdown do texto (asteriscos para negrito)
 */
function stripMarkdown(text: string): string {
  // Remove **texto** e *texto* mantendo apenas o texto interno
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

/**
 * Renderiza a última mensagem do chat na sidebar
 */
export function ChatSidebarItemLastMessage({
  isTyping = false,
  isRecording = false,
  lastMessageIsDeleted = false,
  messageSender,
  messageStatus,
  messageType = "text",
  message,
  isGroup = false,
  className,
}: {
  isTyping?: boolean;
  isRecording?: boolean;
  lastMessageIsDeleted?: boolean;
  messageSender?: "agent" | "contact" | "system";
  messageStatus?: MessageStatus;
  messageType?: "text" | "image" | "video" | "audio" | "document" | "contact" | "system";
  message: string;
  isGroup?: boolean;
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
      {/* Status icon - apenas para mensagens de agent, não para system nem grupos */}
      {messageStatus && messageSender === "agent" && !isGroup && (
        <MessageStatusIcon status={messageStatus} size={14} className="shrink-0" />
      )}

      {/* Ícone de mídia (imagem/vídeo/documento/áudio/contato) */}
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
      {messageType === "contact" && (
        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}

      {/* Texto da mensagem ou label do tipo de mídia */}
      <p className="text-muted-foreground flex-1 truncate text-sm">
        {messageType === "image"
          ? stripMarkdown(message.trim()) || "Enviou uma foto"
          : messageType === "video"
          ? stripMarkdown(message.trim()) || "Enviou um vídeo"
          : messageType === "document"
          ? stripMarkdown(message.trim()) || "Enviou um documento"
          : messageType === "audio"
          ? stripMarkdown(message.trim()) || "Enviou um áudio"
          : messageType === "contact"
          ? stripMarkdown(message.trim()) || "Enviou um contato"
          : stripMarkdown(message)}
      </p>
    </div>
  );
}
