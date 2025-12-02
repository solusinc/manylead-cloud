"use client";

import { Archive } from "lucide-react";
import { Badge, cn } from "@manylead/ui";
import { useChatViewStore } from "~/stores/use-chat-view-store";

interface ChatArchivedBarProps {
  count: number;
  className?: string;
}

export function ChatArchivedBar({ count, className }: ChatArchivedBarProps) {
  const setView = useChatViewStore((state) => state.setView);

  return (
    <button
      onClick={() => setView("archived")}
      className={cn(
        "flex items-center gap-3 px-4 py-3 border-b",
        "hover:bg-accent/50 transition-colors cursor-pointer",
        "text-sm font-medium",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Archive className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="flex-1 text-left">Arquivados</span>
      <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-2 text-xs">
        {count}
      </Badge>
    </button>
  );
}
