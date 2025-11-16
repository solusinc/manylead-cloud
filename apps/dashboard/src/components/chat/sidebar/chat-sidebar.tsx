"use client";

import { cn } from "@manylead/ui";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatSidebarFilters } from "./chat-sidebar-filters";
import { ChatSidebarList } from "./chat-sidebar-list";
import { ChatFiltersSheet } from "../chat-filters-sheet";

export function ChatSidebar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col h-full w-full", className)}
      {...props}
    >
      <ChatSidebarHeader />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <ChatSidebarFilters />
        <ScrollArea className="flex-1">
          <ChatSidebarList />
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
