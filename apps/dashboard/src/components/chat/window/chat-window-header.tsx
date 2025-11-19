"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Archive,
  CheckCircle,
  MoreVertical,
  Tag,
  X,
} from "lucide-react";
import { FaUser, FaWhatsapp } from "react-icons/fa";
import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";

import { ContactDetailsSheet } from "../contact";
import { ChatTransferDropdown } from "./chat-transfer-dropdown";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ChatWindowHeaderProps {
  chat: {
    id: string;
    createdAt: Date;
    contact: {
      name: string;
      phoneNumber: string;
      avatar: string | null;
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

  return (
    <>
      <div
        className={cn(
          "bg-background flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4",
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
        />
      </div>

      <ContactDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        contact={chat.contact}
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
  };
  source?: "whatsapp" | "internal";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}) {
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
            alt={contact.name}
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
          <h3 className="text-sm font-semibold">
            {contact.name}
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
  className,
}: {
  chat: {
    id: string;
    status: "open" | "closed";
    assignedTo: string | null;
  };
  chatId: string;
  chatCreatedAt: Date;
  className?: string;
}) {
  const session = useServerSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Buscar agent atual para verificar se está assigned
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );

  // Mutation para fechar chat
  const closeMutation = useMutation(
    trpc.chats.close.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [["chats"]] });
        void queryClient.invalidateQueries({ queryKey: [["messages"]] });
        toast.success("Atendimento finalizado com sucesso!");
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao finalizar atendimento");
      },
    }),
  );

  // APENAS quem está assigned pode transferir, adicionar tags ou finalizar
  const isAssigned = chat.assignedTo === currentAgent?.id;

  // Se não está assigned, não mostra nenhuma ação
  if (!isAssigned) {
    return null;
  }

  const handleCloseChat = () => {
    closeMutation.mutate({
      id: chatId,
      createdAt: chatCreatedAt,
    });
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <ChatTransferDropdown chatId={chatId} chatCreatedAt={chatCreatedAt} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Etiquetas"
          >
            <Tag className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Etiquetas</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Finalizar"
            onClick={handleCloseChat}
            disabled={closeMutation.isPending || chat.status === "closed"}
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Finalizar</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Archive className="mr-2 h-4 w-4" />
            Arquivar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <X className="mr-2 h-4 w-4" />
            Deletar conversa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
