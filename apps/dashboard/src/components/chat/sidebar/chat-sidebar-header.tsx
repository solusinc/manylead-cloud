"use client";

import { useState } from "react";
import { Search, MessageSquarePlus, Eye, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@manylead/ui";
import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { NewChatDialog } from "../new-chat-dialog";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";

export function ChatSidebarHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "h-14 shrink-0 px-3 border-b bg-background flex items-center gap-2",
          className
        )}
        {...props}
      >
        <ChatSidebarNewButton onClick={() => setDialogOpen(true)} />
        <ChatSidebarSearch />
        <ChatSidebarUnreadButton />
        <ChatSidebarFilterButton />
      </div>

      <NewChatDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

export function ChatSidebarSearch({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [search, setSearch] = useState("");

  return (
    <div className={cn("relative flex-1", className)} {...props}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar contato"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 h-8"
      />
      {search && (
        <button
          onClick={() => setSearch("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ChatSidebarNewButton({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 flex-shrink-0 text-muted-foreground", className)}
          aria-label="Iniciar contato"
          onClick={onClick}
          {...props}
        >
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Iniciar contato</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChatSidebarUnreadButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 flex-shrink-0 text-muted-foreground",
            showUnreadOnly && "bg-accent",
            className
          )}
          aria-label="Conversas não lidas"
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          {...props}
        >
          <Eye className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Conversas não lidas</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ChatSidebarFilterButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { isOpen, open, close } = useChatFiltersStore();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 flex-shrink-0 text-muted-foreground", className)}
          aria-label="Filtros"
          onClick={isOpen ? close : open}
          {...props}
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <SlidersHorizontal className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{isOpen ? "Fechar filtros" : "Filtros"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
