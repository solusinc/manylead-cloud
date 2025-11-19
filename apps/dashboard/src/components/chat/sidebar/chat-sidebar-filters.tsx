"use client";

import { cn } from "@manylead/ui";
import { Badge } from "@manylead/ui/badge";
import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { List, Hourglass, MessageCircle, UserCircle } from "lucide-react";
import { useServerSession } from "~/components/providers/session-provider";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";

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
  const session = useServerSession();
  const trpc = useTRPC();

  // Buscar agent atual para verificar role
  const { data: currentAgent } = useQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id })
  );
  const role = currentAgent?.role;

  // Buscar todos os chats para contar pending
  const { data: chatsData } = useQuery(
    trpc.chats.list.queryOptions({
      limit: 100,
      offset: 0,
    })
  );

  const pendingCount = chatsData?.items.filter((item) => item.chat.status === "pending").length ?? 0;

  // Member não precisa de filtros (só vê seus próprios chats)
  if (role === "member") {
    return (
      <div
        className={cn(
          "flex items-center border-b bg-background px-4 py-3",
          className
        )}
        {...props}
      >
        <span className="text-sm font-medium">
          Meus atendimentos
        </span>
      </div>
    );
  }

  // Admin e Owner veem todas as tabs
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
