"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRightLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  MessageCircle,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@manylead/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import { Textarea } from "@manylead/ui/textarea";

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
  isDeleted?: boolean;
  isEdited?: boolean;
  editedAt?: Date | null;
  readAt?: Date | null;
  repliedToMessageId?: string | null;
  metadata?: Record<string, unknown>;
  chatId?: string;
}

export function ChatMessage({
  message,
  showAvatar: _showAvatar = true,
  canEditMessages = false,
  canDeleteMessages = false,
  className,
  ...props
}: {
  message: Message;
  showAvatar?: boolean;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
} & React.ComponentProps<"div">) {
  const isOutgoing = message.sender === "agent";
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      data-message-id={message.id}
      className={cn(
        "group relative mb-2 flex scroll-mt-20 gap-2",
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
        canEditMessages={canEditMessages}
        canDeleteMessages={canDeleteMessages}
      />
    </div>
  );
}

export function ChatMessageBubble({
  message,
  isOutgoing,
  showActions = false,
  onMenuOpenChange,
  canEditMessages = false,
  canDeleteMessages = false,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  showActions?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
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

      <ChatMessageContent
        content={message.content}
        isOutgoing={isOutgoing}
        isDeleted={message.isDeleted}
      />
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

export function ChatMessageContent({
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
          "text-sm italic opacity-60 flex items-center gap-1.5",
          isOutgoing && "dark:text-white/60",
          className,
        )}
      >
        <Trash2 className="size-3.5" />
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
        "overflow-wrap-anywhere text-sm break-words whitespace-pre-wrap",
        isOutgoing && "dark:text-white",
        className,
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
  isEdited = false,
  isDeleted = false,
  className,
}: {
  timestamp: Date;
  status?: "pending" | "sent" | "delivered" | "read";
  isOutgoing: boolean;
  isStarred?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-1 flex items-center justify-end gap-1", className)}>
      {isStarred && <Star className="h-3 w-3 fill-current opacity-70" />}
      {isEdited && !isDeleted && (
        <span className="text-[10px] opacity-60">editado</span>
      )}
      <ChatMessageTime timestamp={timestamp} />
      {isOutgoing && status && !isDeleted && <ChatMessageStatus status={status} />}
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
  canEditMessages = false,
  canDeleteMessages = false,
  className,
}: {
  message: Message;
  isOutgoing: boolean;
  onOpenChange?: (open: boolean) => void;
  canEditMessages?: boolean;
  canDeleteMessages?: boolean;
  className?: string;
}) {
  // Não mostrar menu de ações para mensagens deletadas
  if (message.isDeleted) {
    return null;
  }

  const { setReplyingTo, contactName } = useChatReply();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  // Não pode editar/deletar se a mensagem já foi lida
  const canEdit = canEditMessages && isOutgoing && !message.readAt && !message.isDeleted;
  const canDelete = canDeleteMessages && isOutgoing && !message.readAt && !message.isDeleted;

  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-sm hover:bg-transparent! hover:text-current! focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-transparent!",
              isOutgoing
                ? "text-foreground/60 dark:text-white/70"
                : "text-muted-foreground",
              className,
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-background/95 w-48 backdrop-blur-sm"
        >
          <DropdownMenuItem
            className="cursor-pointer gap-3"
            onClick={handleReply}
          >
            <MessageCircle className="h-4 w-4" />
            <span>Responder</span>
          </DropdownMenuItem>
          <ChatMessageActionStar message={message} />
          {canEdit && (
            <DropdownMenuItem
              className="cursor-pointer gap-3"
              onSelect={() => setEditDialogOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer gap-3"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span>Deletar</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs renderizados FORA do DropdownMenu */}
      <EditMessageDialog
        message={message}
        open={editDialogOpen && canEdit}
        onOpenChange={setEditDialogOpen}
      />
      <DeleteMessageDialog
        message={message}
        open={deleteDialogOpen && canDelete}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
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
      className="cursor-pointer gap-3"
      onClick={handleToggleStar}
      disabled={toggleStarMutation.isPending}
    >
      <Star className={cn("h-4 w-4", message.isStarred && "fill-current")} />
      <span>{message.isStarred ? "Desfavoritar" : "Favoritar"}</span>
    </DropdownMenuItem>
  );
}

function EditMessageDialog({
  message,
  open,
  onOpenChange,
}: {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editContent, setEditContent] = useState("");

  // Inicializar conteúdo quando abre o dialog
  useEffect(() => {
    if (open) {
      const contentWithoutSignature = message.content.replace(/^\*\*.*?\*\*\n/, "");
      setEditContent(contentWithoutSignature);
    }
  }, [open, message.content]);

  const editMutation = useMutation(
    trpc.messages.edit.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        onOpenChange(false);
        toast.success("Mensagem editada");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao editar mensagem");
      },
    }),
  );

  const handleSave = () => {
    if (!editContent.trim() || !message.chatId) return;

    editMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      chatId: message.chatId,
      content: editContent.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
          <DialogDescription>
            Edite o conteúdo da sua mensagem
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            className="resize-none"
            placeholder="Digite sua mensagem..."
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={editMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={editMutation.isPending || !editContent.trim()}
          >
            {editMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMessageDialog({
  message,
  open,
  onOpenChange,
}: {
  message: Message;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.messages.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        onOpenChange(false);
        toast.success("Mensagem deletada");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao deletar mensagem");
      },
    }),
  );

  const handleDelete = () => {
    if (!message.chatId) return;

    deleteMutation.mutate({
      id: message.id,
      timestamp: message.timestamp,
      chatId: message.chatId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deletar mensagem</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja deletar esta mensagem? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deletando..." : "Deletar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className={cn("group mb-4 flex justify-center", className)}>
      <div
        className="relative flex max-w-2xl items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm shadow-sm dark:bg-emerald-950/30"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1 space-y-1">
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {agentName ?? "Agente"}
          </p>
          <p className="text-foreground whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
        {(isHovered || isMenuOpen) && (
          <div className="absolute top-1 right-1 rounded-full bg-emerald-50/50 p-0.5 transition-all duration-200 dark:bg-emerald-950/50">
            <ChatCommentActions
              message={message}
              onOpenChange={setIsMenuOpen}
            />
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
            "h-6 w-6 rounded-sm text-emerald-600 hover:bg-transparent! hover:text-current! dark:text-emerald-400",
            "data-[state=open]:bg-transparent1 focus-visible:ring-0 focus-visible:ring-offset-0",
            className,
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="bg-background/95 w-48 backdrop-blur-sm"
      >
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer gap-3"
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
    const fields = lines.reduce(
      (acc, line) => {
        const [key, ...valueParts] = line.split(": ");
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join(": ").trim();
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    return (
      <div className={cn("mb-4 flex justify-center", className)}>
        <div className="dark:bg-muted/50 w-full max-w-4xl rounded-lg bg-white px-4 py-3 text-sm shadow-sm">
          {/* Layout em 2 colunas em md/lg */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
            {/* Coluna 1 */}
            <div className="space-y-2">
              {fields.Protocolo && (
                <div>
                  <span className="text-muted-foreground">Protocolo:</span>{" "}
                  <span className="font-semibold break-all">
                    {fields.Protocolo}
                  </span>
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
                  <span className="font-semibold">
                    {fields.Departamento || "-"}
                  </span>
                </div>
              )}
              {fields.Motivo !== undefined && (
                <div>
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  <span className="font-semibold">{fields.Motivo || "-"}</span>
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
                  <span className="font-semibold">
                    {fields["Finalizado em"]}
                  </span>
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
      <div className="dark:bg-muted/50 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>{message.content}</span>
      </div>
    </div>
  );
}
