"use client";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { useState } from "react";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatSidebarFilters } from "./chat-sidebar-filters";
import { ChatSidebarList } from "./chat-sidebar-list";
import { ChatFiltersSheet } from "../chat-filters-sheet";

type FilterType = "all" | "pending" | "open" | "mine";

export function ChatSidebar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  return (
    <div
      className={cn("flex flex-col h-full w-full", className)}
      {...props}
    >
      <ChatSidebarHeader />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <ChatSidebarFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
        <ScrollArea className="flex-1">
          <ChatSidebarList activeFilter={activeFilter} />
        </ScrollArea>
        <ChatFiltersSheet />
      </div>
    </div>
  );
}

export function ChatSidebarContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col h-full", className)} {...props}>
      {children}
    </div>
  );
}
