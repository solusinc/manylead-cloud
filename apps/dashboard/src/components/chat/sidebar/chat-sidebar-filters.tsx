"use client";

import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@manylead/ui/tooltip";
import { List, Hourglass, MessageCircle, UserCircle } from "lucide-react";
import { useState } from "react";

type FilterType = "all" | "pending" | "open" | "closed";

export function ChatSidebarFilters({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  return (
    <div
      className={cn("flex items-center border-b bg-background", className)}
      {...props}
    >
      <ChatSidebarFilterButton
        icon={List}
        label="Todos os atendimentos"
        active={activeFilter === "all"}
        onClick={() => setActiveFilter("all")}
      />
      <ChatSidebarFilterButton
        icon={Hourglass}
        label="Aguardando atendimento"
        active={activeFilter === "pending"}
        onClick={() => setActiveFilter("pending")}
      />
      <ChatSidebarFilterButton
        icon={MessageCircle}
        label="Em atendimento"
        active={activeFilter === "open"}
        onClick={() => setActiveFilter("open")}
      />
      <ChatSidebarFilterButton
        icon={UserCircle}
        label="Meus atendimentos"
        active={activeFilter === "closed"}
        onClick={() => setActiveFilter("closed")}
      />
    </div>
  );
}

export function ChatSidebarFilterButton({
  icon: Icon,
  label,
  active,
  className,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
} & React.ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-12 flex-1 rounded-none border-b-2 border-transparent",
            active && "border-b-primary",
            className
          )}
          aria-label={label}
          {...props}
        >
          <Icon className="h-6 w-6" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
