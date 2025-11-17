"use client";

import { useState } from "react";
import Image from "next/image";
import { FaWhatsapp } from "react-icons/fa";
import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";
import { Button } from "@manylead/ui/button";
import { formatBrazilianPhone } from "@manylead/shared/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@manylead/ui/dropdown-menu";
import {
  MoreVertical,
  Archive,
  X,
  ArrowRightLeft,
  Tag,
  CheckCircle,
} from "lucide-react";
import { ContactDetailsSheet } from "../contact";

interface ChatWindowHeaderProps {
  chat: {
    id: string;
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
          "flex h-14 shrink-0 items-center justify-between gap-4 px-4 border-b bg-background",
          className
        )}
        {...props}
      >
        <ChatWindowHeaderInfo
          contact={chat.contact}
          source={chat.source}
          onClick={() => setDetailsOpen(true)}
        />
        <ChatWindowHeaderActions chat={chat} />
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
  className,
  onClick,
}: {
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
  };
  source?: "whatsapp" | "internal";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        className
      )}
    >
      <Avatar className="h-10 w-10">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-muted relative overflow-hidden">
            <Image
              src="/assets/no-photo.svg"
              alt="No photo"
              fill
              className="object-cover"
            />
          </AvatarFallback>
        )}
      </Avatar>

      <div className="text-left flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{contact.name}</h3>
          {source === "whatsapp" ? (
            <div className="rounded-full p-1 flex items-center justify-center" style={{ backgroundColor: '#7de8a6' }}>
              <FaWhatsapp className="h-3.5 w-3.5 text-black" />
            </div>
          ) : (
            <div className="rounded-full px-1.5 py-0.5 flex items-center justify-center" style={{ backgroundColor: '#7de8a6' }}>
              <span className="text-[10px] font-bold text-black">ML</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatBrazilianPhone(contact.phoneNumber)}
        </p>
      </div>
    </button>
  );
}

export function ChatWindowHeaderActions({
  className,
}: {
  chat: {
    id: string;
    status: "open" | "closed";
    assignedTo: string | null;
  };
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Transferir"
        className="gap-2 text-muted-foreground"
      >
        <ArrowRightLeft className="h-4 w-4" />
        <span className="text-sm hidden lg:inline">transferir</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-label="Etiquetas"
        className="gap-2 text-muted-foreground"
      >
        <Tag className="h-4 w-4" />
        <span className="text-sm hidden lg:inline">etiquetas</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        aria-label="Finalizar"
        className="gap-2 text-muted-foreground"
      >
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm hidden lg:inline">finalizar</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More options" className="text-muted-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Archive className="h-4 w-4 mr-2" />
            Arquivar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">
            <X className="h-4 w-4 mr-2" />
            Deletar conversa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
