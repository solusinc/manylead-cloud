"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@manylead/ui";
import { Button } from "@manylead/ui/button";
import { ScrollArea } from "@manylead/ui/scroll-area";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatSidebarFilters } from "./chat-sidebar-filters";
import { ChatSidebarList } from "./chat-sidebar-list";
import { ChatSidebarContactsList } from "./chat-sidebar-contacts-list";
import { ChatArchivedBar } from "./chat-sidebar-archived-bar";
import { ChatFiltersSheet } from "../chat-filters-sheet";
// import { ChatErrorBoundaryCompact } from "../providers/chat-error-boundary";
import { useChatSearchStore, useIsSearchActive } from "~/stores/use-chat-search-store";
import { useChatViewStore } from "~/stores/use-chat-view-store";
import { useTRPC } from "~/lib/trpc/react";

type FilterType = "all" | "pending" | "open" | "mine";

export function ChatSidebar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const isSearchActive = useIsSearchActive();
  const searchMode = useChatSearchStore((state) => state.searchMode);
  const view = useChatViewStore((state) => state.view);
  const setView = useChatViewStore((state) => state.setView);
  const trpc = useTRPC();

  // Query para contagem de chats arquivados
  const { data: archivedCount } = useQuery(
    trpc.chats.getArchivedCount.queryOptions()
  );

  return (
    <div
      className={cn("flex flex-col h-full w-full", className)}
      {...props}
    >
      {view === "archived" ? (
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("main")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">Arquivados</h2>
        </div>
      ) : (
        <ChatSidebarHeader />
      )}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {view === "main" && (
          <ChatSidebarFilters
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        )}
        {view === "main" && typeof archivedCount === 'number' && archivedCount > 0 && (
          <ChatArchivedBar count={archivedCount} />
        )}
        <ScrollArea className="flex-1">
          {/* <ChatErrorBoundaryCompact> */}
            {isSearchActive && searchMode === "contacts" ? (
              <ChatSidebarContactsList />
            ) : (
              <ChatSidebarList activeFilter={activeFilter} />
            )}
          {/* </ChatErrorBoundaryCompact> */}
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
