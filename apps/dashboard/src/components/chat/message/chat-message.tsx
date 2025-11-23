"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Clock, MessageCircle, Star, ChevronDown, ArrowRightLeft, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import { useTRPC } from "~/lib/trpc/react";
import { useChatReply } from "../providers/chat-reply-provider";

interface Message {
  id: string;
  content: string;
  sender: "contact" | "agent" | "system";
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  messageType?: string;
  isStarred?: boolean;
  repliedToMessageId?: string | null;
  metadata?: Record<string, unknown>;
  chatId?: string;
}

export function ChatMessage({
  message,
  showAvatar: _showAvatar = true,
  className,
  ...props
}: {
  message: Message;
  showAvatar?: boolean;
} & React.ComponentProps<"div">) {
  const isOutgoing = message.sender === "agent";
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "mb-2 flex gap-2 group relative",
        isOutgoing ? "justify-end" : "justify-start",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      <ChatMessageBubble
        message={message}
        isOutgoing={isOutgoing}
        showActions={isHovered || isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
      />
    </div>
  );
}

export function ChatMessageBubble({
  message,
  isOutgoing,
  showActions = false,
  onMenuOpenChange,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  showActions?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  // Extrair dados da mensagem respondida do metadata
  const repliedMessage = message.metadata && message.repliedToMessageId ? {
    content: message.metadata.repliedToContent as string,
    senderName: message.metadata.repliedToSender as string,
  } : null;

  return (
    <div
      className={cn(
        "max-w-[280px] sm:max-w-md md:max-w-lg lg:max-w-xl rounded-2xl relative overflow-hidden",
        repliedMessage ? "px-2 py-1.5" : "px-4 py-2",
        isOutgoing
          ? "bg-msg-outgoing rounded-br-sm"
          : "bg-msg-incoming rounded-bl-sm",
        className,
      )}
    >
      {showActions && (
        <div
          className="absolute top-1 right-1 rounded-full p-0.5 transition-all duration-200"
          style={{
            backgroundImage: isOutgoing
              ? 'radial-gradient(circle at 66% 25%, var(--msg-outgoing) 0%, var(--msg-outgoing) 55%, transparent 70%)'
              : 'radial-gradient(circle at 66% 25%, var(--msg-incoming) 0%, var(--msg-incoming) 55%, transparent 70%)'
          }}
        >
          <ChatMessageActions message={message} isOutgoing={isOutgoing} onOpenChange={onMenuOpenChange} />
        </div>
      )}

      {/* Reply preview - se existe mensagem respondida */}
      {repliedMessage && (
        <ChatMessageReplyPreview
          content={repliedMessage.content}
          senderName={repliedMessage.senderName}
          isOutgoing={isOutgoing}
        />
      )}

      <ChatMessageContent content={message.content} isOutgoing={isOutgoing} />
      <ChatMessageFooter
        timestamp={message.timestamp}
        status={message.status}
        isOutgoing={isOutgoing}
        isStarred={message.isStarred}
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
  className,
}: {
  content: string;
  senderName: string;
  isOutgoing: boolean;
  className?: string;
}) {
  const { messageSource, instanceCode, organizationName } = useChatReply();

  // Remover formatação **Nome**\n do conteúdo (se houver)
  const cleanContent = content.replace(/^\*\*.*?\*\*\n/, "");

  // Truncar conteúdo se for muito longo
  const truncatedContent = cleanContent.length > 50
    ? `${cleanContent.substring(0, 50)}...`
    : cleanContent;

  // Se for internal, mostrar: OrgName + instanceCode / AgentName / Content
  // Se for WhatsApp, mostrar: ContactName / Content
  const isInternal = messageSource === "internal";

  return (
    <div
      className={cn(
        "mb-1.5 rounded-md border-l-4 bg-black/10 px-2 py-1 dark:bg-white/10",
        isOutgoing ? "border-primary" : "border-primary/70",
        className,
      )}
    >
      {isInternal ? (
        <>
          {/* Linha 1: Nome da Org + instanceCode */}
          <div className="flex items-center gap-1.5 mb-1">
            <p className={cn(
              "text-xs font-semibold",
              isOutgoing ? "text-primary dark:text-primary" : "text-primary/90"
            )}>
              {organizationName}
            </p>
            {instanceCode && (
              <span className={cn(
                "text-[10px] opacity-60",
                isOutgoing && "dark:text-white/60"
              )}>
                {instanceCode}
              </span>
            )}
          </div>
          {/* Linha 2: Nome do agente */}
          <p className={cn(
            "text-[11px] opacity-70",
            isOutgoing && "dark:text-white/70"
          )}>
            {senderName}
          </p>
        </>
      ) : (
        /* WhatsApp: apenas nome do contato */
        <p className={cn(
          "text-xs font-semibold",
          isOutgoing ? "text-primary dark:text-primary" : "text-primary/90"
        )}>
          {senderName}
        </p>
      )}
      {/* Linha 3 (ou 2 se WhatsApp): Conteúdo */}
      <p className={cn(
        "text-xs opacity-80 truncate",
        isOutgoing && "dark:text-white/80"
      )}>
        {truncatedContent}
      </p>
    </div>
  );
}

export function ChatMessageContent({
  content,
  className,
  isOutgoing,
}: {
  content: string;
  className?: string;
  isOutgoing?: boolean;
}) {
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
        "break-words text-sm whitespace-pre-wrap overflow-wrap-anywhere",
        isOutgoing && "dark:text-white",
        className
      )}
    >
      {renderContent(content)}
    </p>
  );
}

export function ChatMessageFooter({
  timestamp,
  status,
  isOutgoing,
  isStarred = false,
  className,
}: {
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  isOutgoing: boolean;
  isStarred?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-1 flex items-center justify-end gap-1", className)}>
      {isStarred && <Star className="h-3 w-3 fill-current opacity-70" />}
      <ChatMessageTime timestamp={timestamp} />
      {isOutgoing && status && <ChatMessageStatus status={status} />}
    </div>
  );
}

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

export function ChatMessageActions({
  message,
  isOutgoing,
  onOpenChange,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const { setReplyingTo, contactName } = useChatReply();

  const handleReply = () => {
    // Extrair nome do sender do conteúdo (formato: **Nome**\nConteúdo)
    const match = /^\*\*(.*?)\*\*/.exec(message.content);
    const senderName = match?.[1] ?? (isOutgoing ? "Você" : contactName);

    setReplyingTo({
      id: message.id,
      content: message.content,
      senderName,
      timestamp: message.timestamp,
    });
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-sm hover:!bg-transparent hover:!text-current focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:!bg-transparent",
            isOutgoing ? "text-foreground/60 dark:text-white/70" : "text-muted-foreground",
            className
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background/95 backdrop-blur-sm">
        <DropdownMenuItem className="gap-3 cursor-pointer" onClick={handleReply}>
          <MessageCircle className="h-4 w-4" />
          <span>Responder</span>
        </DropdownMenuItem>
        <ChatMessageActionStar message={message} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ChatMessageActionStar({ message }: { message: Message }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const toggleStarMutation = useMutation(
    trpc.messages.toggleStar.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao favoritar mensagem");
      },
    }),
  );

  const handleToggleStar = () => {
    toggleStarMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      isStarred: !message.isStarred,
    });
  };

  return (
    <DropdownMenuItem
      className="gap-3 cursor-pointer"
      onClick={handleToggleStar}
      disabled={toggleStarMutation.isPending}
    >
      <Star className={cn("h-4 w-4", message.isStarred && "fill-current")} />
      <span>{message.isStarred ? "Desfavoritar" : "Favoritar"}</span>
    </DropdownMenuItem>
  );
}

/**
 * Mensagem de comentário interno (visível apenas para agents)
 * Renderizada com ícone de mensagem e nome do agent
 */
export function ChatMessageComment({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  const agentName = message.metadata?.agentName as string | undefined;
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className={cn("mb-4 flex justify-center group", className)}>
      <div
        className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm shadow-sm max-w-2xl relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <MessageCircle className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {agentName ?? "Agente"}
          </p>
          <p className="text-foreground whitespace-pre-wrap">{message.content}</p>
        </div>
        {(isHovered || isMenuOpen) && (
          <div
            className="absolute top-1 right-1 rounded-full p-0.5 transition-all duration-200 bg-emerald-50/50 dark:bg-emerald-950/50"
          >
            <ChatCommentActions message={message} onOpenChange={setIsMenuOpen} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ações do comentário (deletar)
 */
export function ChatCommentActions({
  message,
  onOpenChange,
  className,
}: {
  message: Message;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteCommentMutation = useMutation(
    trpc.messages.deleteComment.mutationOptions({
      onSuccess: () => {
        toast.success("Comentário removido");
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao remover comentário");
      },
    }),
  );

  const handleDelete = () => {
    if (!message.chatId) {
      toast.error("Erro ao identificar o chat");
      return;
    }

    deleteCommentMutation.mutate({
      id: message.id,
      chatId: message.chatId,
    });
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 rounded-sm hover:!bg-transparent hover:!text-current text-emerald-600 dark:text-emerald-400",
            "focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:!bg-transparent",
            className
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48 bg-background/95 backdrop-blur-sm">
        <DropdownMenuItem
          className="gap-3 cursor-pointer text-destructive focus:text-destructive"
          onClick={handleDelete}
          disabled={deleteCommentMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
          <span>Deletar comentário</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Mensagem de sistema (ex: "Sessão criada", "Transferida de X para Y")
 * Renderizada como badge centralizado na timeline
 * Suporta multi-linha para mensagens de fechamento com layout em 2 colunas (lg/md)
 */
export function ChatMessageSystem({
  message,
  className,
}: {
  message: Message;
  className?: string;
}) {
  // Detectar se é mensagem de fechamento (tem quebras de linha)
  const isClosedMessage = message.content.includes("\n");

  // Se for mensagem de fechamento, parsear os campos
  if (isClosedMessage) {
    const lines = message.content.split("\n");
    const fields = lines.reduce((acc, line) => {
      const [key, ...valueParts] = line.split(": ");
      if (key && valueParts.length > 0) {
        acc[key.trim()] = valueParts.join(": ").trim();
      }
      return acc;
    }, {} as Record<string, string>);

    return (
      <div className={cn("mb-4 flex justify-center", className)}>
        <div className="rounded-lg bg-white dark:bg-muted/50 px-4 py-3 text-sm shadow-sm max-w-2xl w-full">
          {/* Layout em 2 colunas em md/lg */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            {/* Coluna 1 */}
            <div className="space-y-2">
              {fields.Protocolo && (
                <div>
                  <span className="text-muted-foreground">Protocolo:</span>{" "}
                  <span className="font-semibold break-all">{fields.Protocolo}</span>
                </div>
              )}
              {fields.Usuário && (
                <div>
                  <span className="text-muted-foreground">Usuário:</span>{" "}
                  <span className="font-semibold">{fields.Usuário}</span>
                </div>
              )}
              {fields.Departamento !== undefined && (
                <div>
                  <span className="text-muted-foreground">Departamento:</span>{" "}
                  <span className="font-semibold">{fields.Departamento || "-"}</span>
                </div>
              )}
            </div>

            {/* Coluna 2 */}
            <div className="space-y-2">
              {fields["Iniciado em"] && (
                <div>
                  <span className="text-muted-foreground">Iniciado em:</span>{" "}
                  <span className="font-semibold">{fields["Iniciado em"]}</span>
                </div>
              )}
              {fields["Atendido em"] && (
                <div>
                  <span className="text-muted-foreground">Atendido em:</span>{" "}
                  <span className="font-semibold">{fields["Atendido em"]}</span>
                </div>
              )}
              {fields["Finalizado em"] && (
                <div>
                  <span className="text-muted-foreground">Finalizado em:</span>{" "}
                  <span className="font-semibold">{fields["Finalizado em"]}</span>
                </div>
              )}
              {fields.Duração && (
                <div>
                  <span className="text-muted-foreground">Duração:</span>{" "}
                  <span className="font-semibold">{fields.Duração}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mensagens simples (Sessão criada, Transferida, etc.)
  return (
    <div className={cn("mb-4 flex justify-center", className)}>
      <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-muted/50 px-3 py-1.5 text-sm font-semibold shadow-sm">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
