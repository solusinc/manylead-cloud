"use client";

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
  UserPlus,
  Archive,
  X,
  RotateCcw,
  User,
} from "lucide-react";

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
  };
  className?: string;
}

export function ChatWindowHeader({
  chat,
  className,
  ...props
}: ChatWindowHeaderProps & React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-4 px-4 border-b bg-background",
        className
      )}
      {...props}
    >
      <ChatWindowHeaderInfo contact={chat.contact} />
      <ChatWindowHeaderActions chat={chat} />
    </div>
  );
}

export function ChatWindowHeaderInfo({
  contact,
  className,
}: {
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
  };
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className="h-10 w-10">
        {contact.avatar ? (
          <img src={contact.avatar} alt={contact.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </AvatarFallback>
        )}
      </Avatar>

      <div>
        <h3 className="font-medium text-sm">{contact.name}</h3>
        <p className="text-xs text-muted-foreground">
          {formatBrazilianPhone(contact.phoneNumber)}
        </p>
      </div>
    </div>
  );
}

export function ChatWindowHeaderActions({
  chat,
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
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        aria-label="Assign conversation"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Atribuir
      </Button>

      {chat.status === "open" ? (
        <Button
          variant="outline"
          size="sm"
          aria-label="Close conversation"
        >
          <X className="h-4 w-4 mr-2" />
          Fechar
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          aria-label="Reopen conversation"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reabrir
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More options">
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
