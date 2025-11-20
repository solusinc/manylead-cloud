"use client";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { useChatSearchStore } from "~/stores/use-chat-search-store";

/**
 * Tabs de busca exibidas quando o usuário está buscando
 * Substitui as tabs normais (Todos, Aguardando, etc)
 */
export function ChatSidebarSearchTabs({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { searchMode, setSearchMode } = useChatSearchStore();

  return (
    <div
      className={cn("flex items-center border-b bg-background", className)}
      {...props}
    >
      <SearchTabButton
        label="Atendimentos"
        active={searchMode === "chats"}
        onClick={() => setSearchMode("chats")}
      />
      <SearchTabButton
        label="Contatos"
        active={searchMode === "contacts"}
        onClick={() => setSearchMode("contacts")}
      />
    </div>
  );
}

function SearchTabButton({
  label,
  active,
  className,
  ...props
}: {
  label: string;
  active?: boolean;
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "relative h-12 flex-1 rounded-none border-b-2 border-transparent text-muted-foreground text-sm font-medium",
        active && "border-b-primary text-foreground",
        className
      )}
      {...props}
    >
      {label}
    </Button>
  );
}
