"use client";

import { cn } from "@manylead/ui";
import { Badge } from "@manylead/ui/badge";
import { Button } from "@manylead/ui/button";
import { Skeleton } from "@manylead/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { List, Hourglass, MessageCircle, UserCircle } from "lucide-react";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useIsSearchActive } from "~/stores/use-chat-search-store";
import { ChatSidebarSearchTabs } from "./chat-sidebar-search-tabs";

type FilterType = "all" | "pending" | "open" | "mine";

export function ChatSidebarFilters({
  activeFilter,
  onFilterChange,
  className,
  ...props
}: {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
} & React.ComponentProps<"div">) {
  const isSearchActive = useIsSearchActive();
  const trpc = useTRPC();

  // Buscar todos os chats para contar pending (sempre chamar o hook)
  const { data: chatsData, isLoading: isLoadingChats } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  const pendingCount = chatsData?.items.filter((item) => item.chat.status === "pending").length ?? 0;

  // Se busca está ativa, mostrar tabs de busca
  if (isSearchActive) {
    return <ChatSidebarSearchTabs className={className} {...props} />;
  }

  // Loading skeleton
  if (isLoadingChats) {
    return (
      <div
        className={cn("flex items-center border-b bg-background", className)}
        {...props}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex h-12 flex-1 items-center justify-center">
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // Todas as tabs são exibidas para todos os roles
  // O backend (TRPC) cuida de filtrar baseado em permissões de departamento
  return (
    <div
      className={cn("flex items-center border-b bg-background", className)}
      {...props}
    >
      <ChatSidebarFilterButton
        icon={List}
        label="Todos os atendimentos"
        active={activeFilter === "all"}
        onClick={() => onFilterChange?.("all")}
      />
      <ChatSidebarFilterButton
        icon={Hourglass}
        label="Aguardando atendimento"
        active={activeFilter === "pending"}
        onClick={() => onFilterChange?.("pending")}
        badge={pendingCount > 0 ? pendingCount : undefined}
      />
      <ChatSidebarFilterButton
        icon={MessageCircle}
        label="Em atendimento"
        active={activeFilter === "open"}
        onClick={() => onFilterChange?.("open")}
      />
      <ChatSidebarFilterButton
        icon={UserCircle}
        label="Meus atendimentos"
        active={activeFilter === "mine"}
        onClick={() => onFilterChange?.("mine")}
      />
    </div>
  );
}

export function ChatSidebarFilterButton({
  icon: Icon,
  label,
  active,
  badge,
  className,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: number;
} & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-12 flex-1 rounded-none border-b-2 border-transparent text-muted-foreground",
            active && "border-b-primary text-foreground",
            className
          )}
          aria-label={label}
          {...props}
        >
          <Icon className="h-6 w-6" />
          {badge !== undefined && (
            <Badge
              variant="destructive"
              className="absolute right-2 top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {badge}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
