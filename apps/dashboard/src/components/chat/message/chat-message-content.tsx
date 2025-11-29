"use client";

import { memo, useEffect } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { BanIcon, Check, CheckCheck, Clock, FileVideo, Star, FileX } from "lucide-react";
import type { Attachment } from "@manylead/db";

import { cn } from "@manylead/ui";

import { getDocumentType } from "~/lib/document-type-map";
import { formatFileSize, formatDuration } from "@manylead/shared/constants";

import { useChatReply } from "../providers/chat-reply-provider";
import { ChatMessageActions } from "./chat-message-actions";
import { useChatImages } from "./chat-images-context";
import type { Message } from "./chat-message";

/**
 * Scroll para uma mensagem específica e destacá-la
 */
function scrollToMessage(messageId: string) {
  const messageElement = document.querySelector(
    `[data-message-id="${messageId}"]`,
  );
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: "smooth", block: "center" });

    // Adicionar classe de highlight temporária
    messageElement.classList.add("reply-highlight");
    setTimeout(() => {
      messageElement.classList.remove("reply-highlight");
    }, 2000);
  }
}

/**
 * Renderiza attachment de mensagem (foto/vídeo)
 */
export function ChatMessageAttachment({
  attachment,
  messageId,
  onImageLoad,
}: {
  attachment: Attachment;
  messageId: string;
  onImageLoad?: () => void;
}) {
  const { registerImage, openLightbox } = useChatImages();
  const isImage = attachment.mediaType === "image";
  const isVideo = attachment.mediaType === "video";
  const isDocument = attachment.mediaType === "document";

  // Registrar imagem no context quando o componente montar
  useEffect(() => {
    if (isImage && attachment.storageUrl) {
      registerImage({
        url: attachment.storageUrl,
        alt: attachment.fileName,
        messageId,
      });
    }
  }, [isImage, attachment.storageUrl, attachment.fileName, messageId, registerImage]);

  // Se a mídia expirou, mostrar placeholder visual
  if (!attachment.storageUrl) {
    const mediaTypeLabel = isImage ? "Imagem" : isVideo ? "Vídeo" : "Arquivo";

    return (
      <div className="mb-2 overflow-hidden rounded-lg border border-muted-foreground/20">
        <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 bg-muted/30 p-4">
          <FileX className="size-8 text-muted-foreground/50" />
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Esta mídia expirou
            </p>
            <p className="text-xs text-muted-foreground/70">
              Arquivos são mantidos temporariamente
            </p>
          </div>
        </div>
        <div className="border-t border-muted-foreground/10 bg-muted/20 px-3 py-2">
          <p className="truncate text-xs text-muted-foreground/80">
            {mediaTypeLabel} • {attachment.fileName}
            {attachment.fileSize && ` • ${formatFileSize(attachment.fileSize)}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 overflow-hidden rounded-lg">
      {isImage && (
        <button
          onClick={() => openLightbox(messageId)}
          className="cursor-pointer transition-opacity hover:opacity-90"
        >
          <Image
            src={attachment.storageUrl}
            alt={attachment.fileName}
            width={attachment.width ?? 400}
            height={attachment.height ?? 300}
            className="max-h-80 w-full object-cover"
            loading="lazy"
            onLoad={onImageLoad}
          />
        </button>
      )}

      {isVideo && (
        <div className="max-w-sm">
          <video
            src={attachment.storageUrl}
            controls
            className="h-auto max-h-64 w-full rounded-lg object-cover"
            preload="metadata"
          >
            <track kind="captions" />
          </video>
        </div>
      )}

      {isDocument && attachment.mimeType && (
        <a
          href={attachment.storageUrl}
          download={attachment.fileName}
          className="flex items-center gap-3 rounded-lg border border-muted-foreground/20 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
        >
          <DocumentIcon
            mimeType={attachment.mimeType}
            fileName={attachment.fileName}
            fileSize={attachment.fileSize}
          />
        </a>
      )}
    </div>
  );
}

/**
 * Renderiza ícone de documento com info
 */
function DocumentIcon({
  mimeType,
  fileName,
  fileSize,
}: {
  mimeType: string;
  fileName: string;
  fileSize?: number | null;
}) {
  const docType = getDocumentType(mimeType);
  const Icon = docType.icon;

  return (
    <>
      {/* SVG Icon */}
      <div className="flex shrink-0 items-center justify-center">
        <Icon className="h-12 w-12" />
      </div>

      {/* File info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{fileName}</p>
        <p className="text-xs text-muted-foreground">
          {docType.label}
          {fileSize && ` • ${formatFileSize(fileSize)}`}
        </p>
      </div>
    </>
  );
}

/**
 * Bubble da mensagem (container com fundo, padding, actions)
 */
export function ChatMessageBubble({
  message,
  isOutgoing,
  showActions = false,
  onMenuOpenChange,
  canEditMessages = false,
  canDeleteMessages = false,
  onImageLoad,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  showActions?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
  onImageLoad?: () => void;
  className?: string;
}) {
  // Extrair dados da mensagem respondida do metadata
  const repliedMessage =
    message.metadata && message.repliedToMessageId
      ? {
          content: message.metadata.repliedToContent as string,
          senderName: message.metadata.repliedToSender as string,
        }
      : null;

  return (
    <div
      className={cn(
        "relative max-w-[280px] overflow-hidden rounded-2xl sm:max-w-md md:max-w-lg lg:max-w-xl",
        repliedMessage ? "px-2 py-1.5" : "px-2 py-2",
        isOutgoing
          ? "bg-msg-outgoing rounded-br-sm"
          : "bg-msg-incoming rounded-bl-sm",
        className,
      )}
    >
      {showActions && (
        <div
          className="absolute top-1 right-1 z-10 rounded-full p-0.5 transition-all duration-200"
          style={{
            backgroundImage: isOutgoing
              ? "radial-gradient(circle at 66% 25%, var(--msg-outgoing) 0%, var(--msg-outgoing) 55%, transparent 70%)"
              : "radial-gradient(circle at 66% 25%, var(--msg-incoming) 0%, var(--msg-incoming) 55%, transparent 70%)",
          }}
        >
          <ChatMessageActions
            message={message}
            isOutgoing={isOutgoing}
            onOpenChange={onMenuOpenChange}
            canEditMessages={canEditMessages}
            canDeleteMessages={canDeleteMessages}
          />
        </div>
      )}

      {/* Reply preview - se existe mensagem respondida */}
      {repliedMessage && (
        <ChatMessageReplyPreview
          content={repliedMessage.content}
          senderName={repliedMessage.senderName}
          isOutgoing={isOutgoing}
          repliedToMessageId={message.repliedToMessageId}
        />
      )}

      {/* Attachment - se existe e não foi deletada */}
      {message.attachment && !message.isDeleted && (
        <ChatMessageAttachment
          attachment={message.attachment}
          messageId={message.id}
          onImageLoad={onImageLoad}
        />
      )}

      {/* Não mostrar caption se mídia expirou */}
      {!(message.attachment && !message.attachment.storageUrl) && (
        <ChatMessageContent
          content={message.content}
          isOutgoing={isOutgoing}
          isDeleted={message.isDeleted}
        />
      )}
      <ChatMessageFooter
        timestamp={message.timestamp}
        status={message.status}
        isOutgoing={isOutgoing}
        isStarred={message.isStarred}
        isEdited={message.isEdited}
        isDeleted={message.isDeleted}
      />
    </div>
  );
}

/**
 * Preview da mensagem sendo respondida dentro do bubble
 */
export function ChatMessageReplyPreview({
  content,
  senderName,
  isOutgoing,
  repliedToMessageId,
  className,
}: {
  content: string;
  senderName: string;
  isOutgoing: boolean;
  repliedToMessageId?: string | null;
  className?: string;
}) {
  const { messageSource, instanceCode, organizationName } = useChatReply();

  // Remover formatação **Nome**\n do conteúdo (se houver)
  const cleanContent = content.replace(/^\*\*.*?\*\*\n/, "");

  // Truncar conteúdo se for muito longo
  const truncatedContent =
    cleanContent.length > 50
      ? `${cleanContent.substring(0, 50)}...`
      : cleanContent;

  // Se for internal, mostrar: OrgName + instanceCode / AgentName / Content
  // Se for WhatsApp, mostrar: ContactName / Content
  const isInternal = messageSource === "internal";

  const handleClick = () => {
    if (repliedToMessageId) {
      scrollToMessage(repliedToMessageId);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "mb-1.5 rounded-md border-l-4 bg-black/10 px-2 py-1 dark:bg-white/10",
        isOutgoing ? "border-primary" : "border-primary/70",
        repliedToMessageId &&
          "cursor-pointer transition-colors hover:bg-black/20 dark:hover:bg-white/20",
        className,
      )}
    >
      {isInternal ? (
        <>
          {/* Linha 1: Nome da Org + instanceCode */}
          <div className="mb-1 flex items-center gap-1.5">
            <p
              className={cn(
                "text-xs font-semibold",
                isOutgoing
                  ? "text-primary dark:text-primary"
                  : "text-primary/90",
              )}
            >
              {organizationName}
            </p>
            {instanceCode && (
              <span
                className={cn(
                  "text-[10px] opacity-60",
                  isOutgoing && "dark:text-white/60",
                )}
              >
                {instanceCode}
              </span>
            )}
          </div>
          {/* Linha 2: Nome do agente */}
          <p
            className={cn(
              "text-[11px] opacity-70",
              isOutgoing && "dark:text-white/70",
            )}
          >
            {senderName}
          </p>
        </>
      ) : (
        /* WhatsApp: apenas nome do contato */
        <p
          className={cn(
            "text-xs font-semibold",
            isOutgoing ? "text-primary dark:text-primary" : "text-primary/90",
          )}
        >
          {senderName}
        </p>
      )}
      {/* Linha 3 (ou 2 se WhatsApp): Conteúdo */}
      <p
        className={cn(
          "truncate text-xs opacity-80",
          isOutgoing && "dark:text-white/80",
        )}
      >
        {truncatedContent}
      </p>
    </div>
  );
}

/**
 * Conteúdo da mensagem (texto com markdown simples)
 */
export const ChatMessageContent = memo(function ChatMessageContent({
  content,
  className,
  isOutgoing,
  isDeleted,
}: {
  content: string;
  className?: string;
  isOutgoing?: boolean;
  isDeleted?: boolean;
}) {
  // Se a mensagem foi deletada, exibir mensagem padrão
  if (isDeleted) {
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm italic opacity-60",
          isOutgoing && "dark:text-white/60",
          className,
        )}
      >
        <BanIcon className="size-3.5" />
        Esta mensagem foi excluída
      </p>
    );
  }

  // Renderizar markdown simples: **texto** -> <strong>texto</strong>
  const renderContent = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      }
      return part;
    });
  };

  return (
    <p
      className={cn(
        "overflow-wrap-anywhere break-word text-sm whitespace-pre-wrap",
        isOutgoing && "dark:text-white",
        className,
      )}
    >
      {renderContent(content)}
    </p>
  );
});

/**
 * Footer da mensagem (timestamp, status, estrela, editado)
 */
export const ChatMessageFooter = memo(function ChatMessageFooter({
  timestamp,
  status,
  isOutgoing,
  isStarred = false,
  isEdited = false,
  isDeleted = false,
  mediaMetadata,
  className,
}: {
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  isOutgoing: boolean;
  isStarred?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  mediaMetadata?: {
    fileSize?: number;
    duration?: number;
    mediaType?: "image" | "video";
  };
  className?: string;
}) {
  return (
    <div className={cn("mt-1 flex items-center justify-between gap-2", className)}>
      {/* Info da mídia - lado esquerdo */}
      <div className="flex items-center gap-1.5">
        {mediaMetadata && (mediaMetadata.fileSize ?? mediaMetadata.duration) && (
          <>
            <FileVideo className="h-3 w-3 opacity-70" />
            <span className="text-xs opacity-70">
              {mediaMetadata.fileSize && formatFileSize(mediaMetadata.fileSize)}
              {mediaMetadata.fileSize && mediaMetadata.duration && " • "}
              {mediaMetadata.duration && formatDuration(mediaMetadata.duration)}
            </span>
          </>
        )}
      </div>

      {/* Timestamp e status - lado direito */}
      <div className="flex items-center gap-1">
        {isStarred && <Star className="h-3 w-3 fill-current opacity-70" />}
        {isEdited && !isDeleted && (
          <span className="text-[10px] opacity-60">editado</span>
        )}
        <ChatMessageTime timestamp={timestamp} />
        {isOutgoing && status && !isDeleted && (
          <ChatMessageStatus status={status} />
        )}
      </div>
    </div>
  );
});

/**
 * Horário da mensagem (HH:mm)
 */
export function ChatMessageTime({
  timestamp,
  className,
}: {
  timestamp: Date;
  className?: string;
}) {
  return (
    <span className={cn("text-xs opacity-70", className)}>
      {format(timestamp, "HH:mm")}
    </span>
  );
}

/**
 * Status da mensagem (pending, sent, delivered, read)
 */
export function ChatMessageStatus({
  status,
  className,
}: {
  status: "pending" | "sent" | "delivered" | "read";
  className?: string;
}) {
  const iconClass = cn("h-3 w-3", className);

  switch (status) {
    case "pending":
      return <Clock className={cn(iconClass, "text-muted-foreground")} />;
    case "sent":
      return <Check className={cn(iconClass, "opacity-70")} />;
    case "delivered":
      return <CheckCheck className={cn(iconClass, "opacity-70")} />;
    case "read":
      return <CheckCheck className={cn(iconClass, "text-blue-500")} />;
    default:
      return null;
  }
}
