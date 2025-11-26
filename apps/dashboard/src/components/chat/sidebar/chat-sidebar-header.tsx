"use client";

import { useState } from "react";
import { Search, MessageSquarePlus, Eye, SlidersHorizontal, X } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

import { cn } from "@manylead/ui";
import { Badge } from "@manylead/ui/badge";
import { Input } from "@manylead/ui/input";
import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { NewChatDialog } from "../new-chat-dialog";
import { useChatFiltersStore } from "~/stores/use-chat-filters-store";
import { useChatSearchStore } from "~/stores/use-chat-search-store";

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
  const { searchTerm, setSearchTerm, clearSearch } = useChatSearchStore();
  const [localValue, setLocalValue] = useState(searchTerm);

  // Debounced update to store (300ms delay)
  const debouncedSetSearchTerm = useDebouncedCallback(
    (value: string) => {
      setSearchTerm(value);
    },
    300
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    debouncedSetSearchTerm(value);
  };

  const handleClear = () => {
    setLocalValue("");
    clearSearch();
  };

  return (
    <div className={cn("relative flex-1", className)} {...props}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar contato"
        value={localValue}
        onChange={handleChange}
        className="pl-10 h-8 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      {localValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-foreground"
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
          className={cn("h-9 w-9 flex-shrink-0", className)}
          aria-label="Iniciar contato"
          onClick={onClick}
          {...props}
        >
          <MessageSquarePlus className="size-5" />
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
  const { showUnreadOnly, toggleUnreadOnly } = useChatFiltersStore();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 flex-shrink-0",
            showUnreadOnly && "bg-accent",
            className
          )}
          aria-label="Conversas não lidas"
          onClick={toggleUnreadOnly}
          {...props}
        >
          <Eye className="size-5" />
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
  const { isOpen, open, close, getActiveFilterCount } = useChatFiltersStore();
  const activeFilterCount = getActiveFilterCount();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-9 w-9 flex-shrink-0 relative", className)}
          aria-label="Filtros"
          onClick={isOpen ? close : open}
          {...props}
        >
          <div className="relative">
            {isOpen ? (
              <X className="size-5" />
            ) : (
              <SlidersHorizontal className="size-5" />
            )}
            {!isOpen && activeFilterCount > 0 && (
              <Badge
                className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
              >
                {activeFilterCount}
              </Badge>
            )}
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{isOpen ? "Fechar filtros" : "Filtros"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
