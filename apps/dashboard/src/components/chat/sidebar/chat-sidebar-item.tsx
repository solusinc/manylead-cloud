/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isThisWeek, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Archive, ChevronDown, Clock, Pin, User } from "lucide-react";
import { FaUser, FaWhatsapp } from "react-icons/fa";
import { toast } from "sonner";

import type { Tag } from "@manylead/db";
import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Badge } from "@manylead/ui/badge";
import { Button } from "@manylead/ui/button";

import type { MessageStatus } from "../message/message-status-icon";
import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useDebouncedValue } from "~/hooks/use-debounced-value";
import { useTRPC } from "~/lib/trpc/react";
import { useChatViewStore } from "~/stores/use-chat-view-store";
import { ChatSidebarItemLastMessage } from "./chat-sidebar-item-last-message";

// Calcula se o texto deve ser branco ou preto baseado na luminosidade do fundo
function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Fórmula de luminosidade relativa
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

interface ChatSidebarItemProps {
  chat: {
    id: string;
    createdAt: Date;
    isPinned: boolean;
    isArchived: boolean;
    contact: {
      name: string;
      avatar: string | null;
    };
    lastMessage: string;
    lastMessageAt: Date;
    lastMessageStatus?: "pending" | "sent" | "delivered" | "read" | "failed";
    lastMessageSender?: "agent" | "contact" | "system";
    lastMessageType?:
      | "text"
      | "image"
      | "video"
      | "audio"
      | "document"
      | "system";
    lastMessageIsDeleted: boolean;
    unreadCount: number;
    status: "open" | "closed" | "pending";
    messageSource?: "whatsapp" | "internal";
    tags?: Pick<Tag, "id" | "name" | "color">[];
    assignedAgentName?: string | null;
    assignedTo?: string | null;
  };
  isActive?: boolean;
  isTyping?: boolean;
  isRecording?: boolean;
  currentAgentId?: string;
  className?: string;
}

export function ChatSidebarItem({
  chat,
  isActive,
  isTyping = false,
  isRecording = false,
  currentAgentId,
  className,
  ...props
}: ChatSidebarItemProps & React.ComponentProps<"a">) {
  const isClosed = chat.status === "closed";
  const isPending = chat.status === "pending";
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const view = useChatViewStore((state) => state.view);

  const togglePinMutation = useMutation(
    trpc.chats.togglePin.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats"]] });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao fixar conversa");
      },
    }),
  );

  const toggleArchiveMutation = useMutation(
    trpc.chats.toggleArchive.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats"]] });
        void queryClient.invalidateQueries({
          queryKey: [["chats", "getArchivedCount"]],
        });
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao arquivar conversa");
      },
    }),
  );

  const handleTogglePin = () => {
    togglePinMutation.mutate({
      id: chat.id,
      createdAt: chat.createdAt,
      isPinned: !chat.isPinned,
    });
  };

  const handleToggleArchive = () => {
    toggleArchiveMutation.mutate({
      id: chat.id,
      createdAt: chat.createdAt,
      isArchived: !chat.isArchived,
    });
  };

  return (
    <Link
      href={`/chats/${chat.id}`}
      className={cn(
        "group hover:bg-accent/50 relative flex h-24 cursor-pointer items-start gap-3 border-b p-4 transition-colors",
        isActive && "bg-accent",
        isClosed && "opacity-60 grayscale",
        className,
      )}
      {...props}
    >
      <ChatSidebarItemAvatar
        name={chat.contact.name}
        avatar={chat.contact.avatar}
        messageSource={chat.messageSource}
      />

      <div className="min-w-0 flex-1">
        <ChatSidebarItemContent
          name={chat.contact.name}
          message={chat.lastMessage}
          timestamp={chat.lastMessageAt}
          messageStatus={chat.lastMessageStatus}
          messageSender={chat.lastMessageSender}
          messageType={chat.lastMessageType}
          lastMessageIsDeleted={chat.lastMessageIsDeleted}
          unreadCount={chat.unreadCount}
          isTyping={isTyping}
          isRecording={isRecording}
          isActive={isActive}
          tags={chat.tags}
          assignedTo={chat.assignedTo}
          currentAgentId={currentAgentId}
        />
      </div>

      {/* Info do pin/agente/actions - absolute no canto inferior direito */}
      {!isClosed && (
        <div className="text-muted-foreground absolute right-2 bottom-1 flex items-center gap-1.5 text-[10px]">
          {/* Agent info - só visível no hover */}
          <span className="flex max-w-0 items-center gap-1 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover:max-w-[200px] group-hover:opacity-100">
            {isPending || !chat.assignedAgentName ? (
              <>
                <Clock className="h-3 w-3" />
                <span>Aguardando</span>
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                <span>{chat.assignedAgentName}</span>
              </>
            )}
          </span>

          {/* Pin icon - sempre visível se fixado */}
          {chat.isPinned && <Pin className="text-primary h-3 w-3" />}

          {/* Actions dropdown - só visível no hover */}
          <div
            className="max-w-0 overflow-hidden opacity-0 transition-all group-hover:max-w-6 group-hover:opacity-100"
            onClick={(e) => e.preventDefault()}
          >
            <QuickActions
              align="end"
              side="bottom"
              actions={[
                ...(view !== "archived"
                  ? [
                      {
                        id: "pin",
                        label: chat.isPinned ? "Desafixar" : "Fixar",
                        icon: Pin,
                        variant: "default" as const,
                        onClick: handleTogglePin,
                      },
                    ]
                  : []),
                {
                  id: "archive",
                  label: chat.isArchived ? "Desarquivar" : "Arquivar",
                  icon: Archive,
                  variant: "default" as const,
                  onClick: handleToggleArchive,
                },
              ]}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-transparent"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </QuickActions>
          </div>
        </div>
      )}
    </Link>
  );
}

export function ChatSidebarItemAvatar({
  name,
  avatar,
  messageSource = "whatsapp",
  className,
}: {
  name: string;
  avatar: string | null;
  messageSource?: "whatsapp" | "internal";
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className="h-12 w-12 border">
        {avatar ? (
          <img src={avatar} alt={name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground">
            <FaUser className="h-5 w-5" />
          </AvatarFallback>
        )}
      </Avatar>

      {/* Badge no canto inferior esquerdo */}
      <div className="border-background bg-background absolute -bottom-0.5 -left-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2">
        {messageSource === "whatsapp" ? (
          <FaWhatsapp className="h-3 w-3 text-green-500" />
        ) : (
          <>
            <Image
              src="/assets/manylead-icon-light.png"
              alt="ManyLead"
              width={12}
              height={12}
              className="dark:hidden"
            />
            <Image
              src="/assets/manylead-icon-dark.png"
              alt="ManyLead"
              width={12}
              height={12}
              className="hidden dark:block"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ChatSidebarItemContent({
  name,
  message,
  timestamp,
  messageStatus,
  messageSender,
  messageType = "text",
  lastMessageIsDeleted = false,
  unreadCount,
  isTyping = false,
  isRecording = false,
  isActive = false,
  tags,
  assignedTo,
  currentAgentId,
  className,
}: {
  name: string;
  message: string;
  timestamp: Date;
  messageStatus?: MessageStatus;
  messageSender?: "agent" | "contact" | "system";
  messageType?: "text" | "image" | "video" | "audio" | "document" | "system";
  lastMessageIsDeleted?: boolean;
  unreadCount: number;
  isTyping?: boolean;
  isRecording?: boolean;
  isActive?: boolean;
  tags?: Pick<Tag, "id" | "name" | "color">[];
  assignedTo?: string | null;
  currentAgentId?: string;
  className?: string;
}) {
  // Debounce de 100ms para evitar flickering do badge
  // Quando mensagem chega em chat ativo, markAsRead é chamado em < 50ms
  // Então badge nunca chega a aparecer
  const debouncedUnreadCount = useDebouncedValue(unreadCount, 100);

  // REGRA: Só ocultar badge otimisticamente se o chat está assigned ao agente atual
  // Se não está assigned ou está assigned para outro, sempre mostrar badge (não ocultar otimisticamente)
  const isAssignedToMe = assignedTo === currentAgentId;

  // Nunca mostrar badge se chat está ativo E está assigned ao usuário (sendo visualizado)
  // Mesmo que backend ainda não tenha zerado o unreadCount
  const shouldShowBadge =
    debouncedUnreadCount > 0 && !(isActive && isAssignedToMe);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        <ChatSidebarItemTime timestamp={timestamp} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <ChatSidebarItemLastMessage
          isTyping={isTyping}
          isRecording={isRecording}
          lastMessageIsDeleted={lastMessageIsDeleted}
          messageSender={messageSender}
          messageStatus={messageStatus}
          messageType={messageType}
          message={message}
        />
        {shouldShowBadge && (
          <ChatSidebarItemBadge count={debouncedUnreadCount} />
        )}
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              className="h-4 border-0 px-1.5 text-[10px] font-medium"
              style={{
                backgroundColor: tag.color,
                color: getContrastTextColor(tag.color),
              }}
            >
              {tag.name}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              +{tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatSidebarItemTime({
  timestamp,
  className,
}: {
  timestamp: Date;
  className?: string;
}) {
  let formatted: string;

  if (isToday(timestamp)) {
    // Hoje: mostra apenas a hora (ex: "14:30")
    formatted = format(timestamp, "HH:mm");
  } else if (isYesterday(timestamp)) {
    // Ontem: mostra "Ontem"
    formatted = "Ontem";
  } else if (isThisWeek(timestamp, { weekStartsOn: 0 })) {
    // Esta semana: mostra o dia da semana (ex: "Segunda")
    formatted = format(timestamp, "EEEE", { locale: ptBR });
    // Capitaliza a primeira letra
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } else {
    // Mais antigo: mostra a data (ex: "10/01/2025")
    formatted = format(timestamp, "dd/MM/yyyy");
  }

  return (
    <span
      className={cn(
        "text-muted-foreground text-xs whitespace-nowrap",
        className,
      )}
    >
      {formatted}
    </span>
  );
}

export function ChatSidebarItemBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <Badge
      variant="default"
      className={cn("h-5 min-w-5 rounded-full px-1.5 text-[10px]", className)}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
