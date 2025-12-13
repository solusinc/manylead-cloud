"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { BanIcon, Check, CheckCheck, Clock, Star, FileX, Image as ImageIcon, Video, Mic, FileText, Loader2, XCircle } from "lucide-react";
import type { Attachment } from "@manylead/db";

import { cn } from "@manylead/ui";

import { getDocumentType } from "~/lib/document-type-map";
import { formatFileSize, formatDuration } from "@manylead/shared/constants";

import { useChat } from "../providers/chat-context";
import { ChatMessageActions } from "./chat-message-actions";
import { useChatImages } from "./chat-images-context";
import { AudioPlayer } from "./audio-player";
import type { Message } from "./chat-message";
import { ChatMessageContact } from "./chat-message-contact";

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
  onAudioTimeUpdate,
  isOwnMessage = false,
  disableLightbox = false,
}: {
  attachment: Attachment;
  messageId: string;
  onImageLoad?: () => void;
  onAudioTimeUpdate?: (currentTime: number, isPlaying: boolean) => void;
  isOwnMessage?: boolean;
  disableLightbox?: boolean;
}) {
  const { registerImage, openLightbox } = useChatImages();
  const isImage = attachment.mediaType === "image";
  const isVideo = attachment.mediaType === "video";
  const isDocument = attachment.mediaType === "document";
  const isAudio = attachment.mediaType === "audio";
  const [imageLoaded, setImageLoaded] = useState(false);

  // Pré-carregar imagem para evitar layout shift
  useEffect(() => {
    if (isImage && attachment.storageUrl) {
      const img = new window.Image();
      img.onload = () => {
        setImageLoaded(true);
        onImageLoad?.();
      };
      img.src = attachment.storageUrl;

      registerImage({
        url: attachment.storageUrl,
        alt: attachment.fileName,
        messageId,
      });
    }
  }, [isImage, attachment.storageUrl, attachment.fileName, messageId, registerImage, onImageLoad]);

  // Se a mídia expirou, mostrar placeholder visual
  if (!attachment.storageUrl) {
    const mediaTypeLabel = isImage ? "Imagem" : isVideo ? "Vídeo" : isAudio ? "Áudio" : "Arquivo";

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
          onClick={disableLightbox ? undefined : () => openLightbox(messageId)}
          className={cn(
            "relative w-full overflow-hidden rounded-lg bg-muted/30 transition-opacity",
            !disableLightbox && "cursor-pointer hover:opacity-90"
          )}
          style={{
            maxWidth: '400px',
            maxHeight: '320px',
            aspectRatio: attachment.width && attachment.height
              ? `${attachment.width} / ${attachment.height}`
              : '4 / 3',
          }}
        >
          <Image
            src={attachment.storageUrl}
            alt={attachment.fileName}
            width={attachment.width ?? 400}
            height={attachment.height ?? 300}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            loading="eager"
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

      {isAudio && (
        <AudioPlayer
          src={attachment.storageUrl}
          duration={attachment.duration}
          onTimeUpdate={onAudioTimeUpdate}
          isOwnMessage={isOwnMessage}
        />
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
  // Estado para playback de áudio
  const [audioPlayback, setAudioPlayback] = useState<{
    currentTime: number;
    isPlaying: boolean;
  }>({ currentTime: 0, isPlaying: false });

  // Check if audio is processing (optimistic UI)
  const isProcessingAudio = message.attachment?.mediaType === "audio" &&
    (message.attachment as Record<string, unknown>)._isProcessing;

  // If processing audio, show skeleton bubble instead of normal bubble
  if (isProcessingAudio) {
    return <AudioProcessingSkeleton isOwnMessage={isOutgoing} />;
  }

  // Passar metadata completo para o componente
  const hasReply = Boolean(message.metadata && message.repliedToMessageId);

  return (
    <div
      className={cn(
        "relative max-w-[280px] overflow-hidden rounded-sm sm:max-w-md md:max-w-lg lg:max-w-xl",
        hasReply ? "px-2 py-1.5" : "px-2 py-2",
        isOutgoing
          ? "bg-msg-outgoing"
          : "bg-msg-incoming",
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
      {hasReply && message.metadata && (
        <ChatMessageReplyPreview
          metadata={message.metadata}
          isOutgoing={isOutgoing}
          repliedToMessageId={message.repliedToMessageId}
        />
      )}

      {/* Renderizar baseado no tipo de mensagem */}
      {message.messageType === "contact" && message.metadata ? (
        /* Mensagem de contato - preview especial */
        <ChatMessageContact
          metadata={message.metadata}
          isOutgoing={isOutgoing}
        />
      ) : message.attachment && !message.isDeleted ? (
        <>
          {/* Attachment/Mídia */}
          <ChatMessageAttachment
            attachment={message.attachment}
            messageId={message.id}
            onImageLoad={onImageLoad}
            onAudioTimeUpdate={(currentTime, isPlaying) =>
              setAudioPlayback({ currentTime, isPlaying })
            }
            isOwnMessage={isOutgoing}
          />

          {/* Caption - mostrar DEPOIS da mídia */}
          <ChatMessageCaption
            content={message.content}
            isOutgoing={isOutgoing}
          />
        </>
      ) : (
        /* Mensagem sem attachment - mostrar conteúdo normal */
        !(message.attachment && !message.attachment.storageUrl) && (
          <ChatMessageContent
            senderName={message.senderName}
            content={message.content}
            isOutgoing={isOutgoing}
            isDeleted={message.isDeleted}
          />
        )
      )}
      <ChatMessageFooter
        timestamp={message.timestamp}
        status={message.status}
        isOutgoing={isOutgoing}
        isStarred={message.isStarred}
        isEdited={message.isEdited}
        isDeleted={message.isDeleted}
        mediaMetadata={
          message.attachment
            ? {
                duration: audioPlayback.isPlaying && audioPlayback.currentTime > 0
                  ? audioPlayback.currentTime
                  : (message.attachment.duration ?? undefined),
                fileSize: message.attachment.fileSize ?? undefined,
                mediaType: message.attachment.mediaType as "image" | "video" | undefined,
              }
            : undefined
        }
      />
    </div>
  );
}

/**
 * Preview da mensagem sendo respondida dentro do bubble
 */
export function ChatMessageReplyPreview({
  metadata,
  isOutgoing,
  repliedToMessageId,
  className,
}: {
  metadata: Record<string, unknown>;
  isOutgoing: boolean;
  repliedToMessageId?: string | null;
  className?: string;
}) {
  // Extrair dados do metadata
  const content = metadata.repliedToContent as string;
  const senderName = metadata.repliedToSender as string;
  const messageType = metadata.repliedToMessageType as string | undefined;

  const isMedia = messageType && messageType !== "text";

  // Map de ícones e labels para mídia
  const mediaConfig: Record<string, { icon: typeof ImageIcon; label: string }> = {
    image: { icon: ImageIcon, label: "Foto" },
    video: { icon: Video, label: "Vídeo" },
    audio: { icon: Mic, label: "Áudio" },
    document: { icon: FileText, label: "Documento" },
  };

  const mediaInfo = isMedia && messageType && messageType in mediaConfig
    ? mediaConfig[messageType]
    : null;

  const MediaIcon = mediaInfo?.icon ?? null;
  const mediaLabel = mediaInfo?.label ?? null;

  // Remover formatação **Nome**\n do conteúdo (se houver)
  const cleanContent = content.replace(/^\*\*.*?\*\*\n/, "");

  // Truncar conteúdo se for muito longo
  const truncatedContent =
    cleanContent.length > 50
      ? `${cleanContent.substring(0, 50)}...`
      : cleanContent;

  const handleClick = () => {
    if (repliedToMessageId) {
      scrollToMessage(repliedToMessageId);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "mb-2 -mx-1 -mt-0.5 rounded-sm border-l-4 bg-black/10 px-2 py-2 dark:bg-white/10",
        isOutgoing ? "border-primary" : "border-primary/70",
        repliedToMessageId &&
          "cursor-pointer transition-colors hover:bg-black/20 dark:hover:bg-white/20",
        className,
      )}
    >
      {/* Nome do remetente */}
      <p
        className={cn(
          "text-xs font-semibold",
          isOutgoing ? "text-primary dark:text-primary" : "text-primary/90",
        )}
      >
        {senderName}
      </p>
      {/* Conteúdo ou Mídia */}
      {isMedia ? (
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          {MediaIcon && <MediaIcon className="h-3.5 w-3.5" />}
          <span>{mediaLabel}</span>
        </div>
      ) : (
        <p
          className={cn(
            "truncate text-xs opacity-80",
            isOutgoing && "dark:text-white/80",
          )}
        >
          {truncatedContent}
        </p>
      )}
    </div>
  );
}

/**
 * Conteúdo da mensagem (texto com markdown simples)
 */
export const ChatMessageContent = memo(function ChatMessageContent({
  senderName,
  content,
  className,
  isOutgoing,
  isDeleted,
}: {
  senderName?: string;
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

  // Renderizar markdown: **texto** ou *texto* -> <strong>texto</strong> (WhatsApp style)
  const renderContent = (text: string) => {
    // Suportar tanto **texto** quanto *texto* para negrito (WhatsApp usa *texto*)
    // Regex: primeiro tenta **texto**, depois *texto* (evitar conflito)
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

    return parts.map((part, index) => {
      // **texto** - dois asteriscos
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return <strong key={index}>{boldText}</strong>;
      }
      // *texto* - um asterisco (WhatsApp style)
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        const boldText = part.slice(1, -1);
        return <strong key={index}>{boldText}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {senderName && (
        <p className={cn("text-sm font-semibold", isOutgoing && "dark:text-white")}>
          {senderName}
        </p>
      )}
      <p
        className={cn(
          "overflow-wrap-anywhere break-word text-sm whitespace-pre-wrap",
          isOutgoing && "dark:text-white",
          className,
        )}
      >
        {renderContent(content)}
      </p>
    </>
  );
});

/**
 * Assinatura da mensagem (para mídias - mostra apenas o nome do sender)
 */
export const ChatMessageSignature = memo(function ChatMessageSignature({
  senderName,
  isOutgoing,
  className,
}: {
  senderName?: string;
  isOutgoing?: boolean;
  className?: string;
}) {
  if (!senderName) return null;

  return (
    <p
      className={cn(
        "text-sm font-semibold",
        isOutgoing && "dark:text-white",
        className,
      )}
    >
      {senderName}
    </p>
  );
});

/**
 * Caption da mensagem (para mídias - mostra o texto/caption)
 */
export const ChatMessageCaption = memo(function ChatMessageCaption({
  content,
  isOutgoing,
  className,
}: {
  content: string;
  isOutgoing?: boolean;
  className?: string;
}) {
  // Se não há caption, não renderizar nada
  if (!content.trim()) return null;

  return (
    <p
      className={cn(
        "overflow-wrap-anywhere break-word text-sm whitespace-pre-wrap mt-1",
        isOutgoing && "dark:text-white",
        className,
      )}
    >
      {content}
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
  status?: "pending" | "sent" | "delivered" | "read" | "failed";
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
  const { chat } = useChat();
  const isGroup = chat.contact.isGroup ?? false;
  const isFailed = status === "failed";

  // Se falhou, mostrar apenas X vermelho
  if (isFailed) {
    return (
      <div className={cn("mt-1 flex items-center justify-end gap-1", className)}>
        <XCircle className="h-3.5 w-3.5 text-red-500" />
      </div>
    );
  }

  return (
    <div className={cn("mt-1 flex items-center justify-between gap-2", className)}>
      {/* Info da mídia - lado esquerdo */}
      <div className="flex items-center gap-1.5">
        {mediaMetadata?.duration && (
          <span className="text-xs opacity-70">
            {formatDuration(mediaMetadata.duration)}
          </span>
        )}
      </div>

      {/* Timestamp e status - lado direito */}
      <div className="flex items-center gap-1">
        {isStarred && <Star className="h-3 w-3 fill-current opacity-70" />}
        {isEdited && !isDeleted && (
          <span className="text-[10px] opacity-60">editado</span>
        )}
        <ChatMessageTime timestamp={timestamp} />
        {isOutgoing && status && !isDeleted && !isGroup && (
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
  const iconClass = cn("h-3.5 w-3.5", className);

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

/**
 * Skeleton placeholder for audio while worker is processing
 * Shows a bubble with loader and "Processando áudio" text
 */
function AudioProcessingSkeleton({ isOwnMessage }: { isOwnMessage: boolean }) {
  return (
    <div className="mb-2">
      <div className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3",
        isOwnMessage ? "bg-msg-outgoing" : "bg-msg-incoming"
      )}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className={cn(
          "text-sm",
          isOwnMessage && "dark:text-white"
        )}>
          Processando áudio...
        </span>
      </div>
    </div>
  );
}
