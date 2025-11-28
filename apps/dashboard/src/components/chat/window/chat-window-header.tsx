"use client";

import { useState } from "react";
import Image from "next/image";
import {
  EyeOff,
  History,
  MoreVertical,
  Search,
  Star,
  User,
} from "lucide-react";
import { FaUser, FaWhatsapp } from "react-icons/fa";
import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import { useRouter } from "next/navigation";

import { ContactDetailsSheet } from "../contact";
import { ChatTransferDropdown } from "./chat-transfer-dropdown";
import { ChatTagSelector } from "./chat-tag-selector";
import { ChatEndingSelector } from "./chat-ending-selector";
import { ChatSearchSheet } from "./chat-search-sheet";
import { ChatStarredSheet } from "./chat-starred-sheet";
import { ChatHistorySheet } from "./chat-history-sheet";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface ChatWindowHeaderProps {
  chat: {
    id: string;
    createdAt: Date;
    contact: {
      id: string;
      name: string;
      phoneNumber: string;
      avatar: string | null;
      instanceCode?: string;
      customName?: string | null;
      notes?: string | null;
      customFields?: Record<string, string> | null;
    };
    status: "open" | "closed";
    assignedTo: string | null;
    source?: "whatsapp" | "internal";
  };
  className?: string;
}

export function ChatWindowHeader({
  chat,
  className,
  ...props
}: ChatWindowHeaderProps & React.ComponentProps<"div">) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const contactDisplayName = chat.contact.customName ?? chat.contact.name;

  return (
    <>
      <div
        className={cn(
          "bg-background flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 shadow-sm",
          className,
        )}
        {...props}
      >
        <ChatWindowHeaderInfo
          contact={chat.contact}
          source={chat.source}
          onClick={() => setDetailsOpen(true)}
        />
        <ChatWindowHeaderActions
          chat={chat}
          chatId={chat.id}
          chatCreatedAt={chat.createdAt}
          onOpenDetails={() => setDetailsOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenStarred={() => setStarredOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      </div>

      <ContactDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        contact={chat.contact}
        source={chat.source}
      />

      <ChatSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        chatId={chat.id}
        contactName={contactDisplayName}
      />

      <ChatStarredSheet
        open={starredOpen}
        onOpenChange={setStarredOpen}
        chatId={chat.id}
      />

      <ChatHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        contactId={chat.contact.id}
        currentChatId={chat.id}
      />
    </>
  );
}

export function ChatWindowHeaderInfo({
  contact,
  source = "whatsapp",
  isTyping = false,
  className,
  onClick,
}: {
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
    customName?: string | null;
  };
  source?: "whatsapp" | "internal";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const displayName = contact.customName ?? contact.name;

  return (
    <button
      onClick={onClick}
      className={cn("flex cursor-pointer items-center gap-3", className)}
    >
      <Avatar className="h-10 w-10 border">
        {contact.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.avatar}
            alt={displayName}
            className="object-cover"
          />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground">
            <FaUser className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">
            {displayName}
          </h3>
          {source === "whatsapp" ? (
            <FaWhatsapp className="h-4 w-4" />
          ) : (
            <>
              <Image
                src="/assets/manylead-icon-light.png"
                alt="ManyLead"
                width={16}
                height={16}
                className="dark:hidden"
              />
              <Image
                src="/assets/manylead-icon-dark.png"
                alt="ManyLead"
                width={16}
                height={16}
                className="hidden dark:block"
              />
            </>
          )}
        </div>
        {isTyping && (
          <p className="text-muted-foreground text-xs">digitando...</p>
        )}
      </div>
    </button>
  );
}

export function ChatWindowHeaderActions({
  chat,
  chatId,
  chatCreatedAt,
  onOpenDetails,
  onOpenSearch,
  onOpenStarred,
  onOpenHistory,
  className,
}: {
  chat: {
    id: string;
    status: "open" | "closed";
    assignedTo: string | null;
  };
  chatId: string;
  chatCreatedAt: Date;
  onOpenDetails?: () => void;
  onOpenSearch?: () => void;
  onOpenStarred?: () => void;
  onOpenHistory?: () => void;
  className?: string;
}) {
  const session = useServerSession();
  const trpc = useTRPC();
  const router = useRouter();

  // Buscar agent atual para verificar se está assigned
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );

  // Mutation para marcar como não lida
  const markAsUnreadMutation = useMutation(
    trpc.chats.markAsUnread.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Erro ao marcar como não lida");
      },
    }),
  );

  // Owner/Admin podem ver ações em chats PENDING
  // Members só veem se estiverem assigned
  const isOwnerOrAdmin = currentAgent?.role === "owner" || currentAgent?.role === "admin";
  const isAssigned = chat.assignedTo === currentAgent?.id;
  const isPending = chat.assignedTo === null;
  const isClosed = chat.status === "closed";

  // Mostrar ações se: (Owner/Admin vendo pending OU assigned ao usuário) E não fechado
  const showActions = ((isOwnerOrAdmin && isPending) || isAssigned) && !isClosed;

  const handleMarkAsUnread = () => {
    // Navegar primeiro para desmontar o chat-window (evita que markAsRead seja chamado)
    router.push("/chats");
    // Depois chamar a mutation em background
    markAsUnreadMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
    });
  };

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {showActions && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ChatTransferDropdown chatId={chatId} chatCreatedAt={chatCreatedAt} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Transferir</p>
            </TooltipContent>
          </Tooltip>

          <ChatTagSelector chatId={chatId} chatCreatedAt={chatCreatedAt} />

          <ChatEndingSelector chatId={chatId} chatCreatedAt={chatCreatedAt} />
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
          >
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpenDetails}>
            <User className="mr-2 h-4 w-4" />
            Informações do lead
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleMarkAsUnread}>
            <EyeOff className="mr-2 h-4 w-4" />
            Marcar como não lida
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenSearch}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenStarred}>
            <Star className="mr-2 h-4 w-4" />
            Mensagens favoritas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenHistory}>
            <History className="mr-2 h-4 w-4" />
            Histórico
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
