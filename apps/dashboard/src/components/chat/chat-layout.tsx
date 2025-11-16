"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, Menu } from "lucide-react";
import { Button } from "@manylead/ui/button";
import { cn } from "@manylead/ui";
import { useSidebar } from "@manylead/ui/sidebar";

import { ChatSidebar } from "./sidebar";
import { ChatWindowEmpty } from "./window";

export function ChatLayout({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { hasChatSelected?: boolean }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  return (
    <div className={cn("flex flex-col h-full", className)} {...props}>
      {/* Mobile Header - só aparece quando tem chat selecionado */}
      {hasChatSelected && (
        <div className="sm:hidden h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/chats")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ChatLayoutSidebar hasChatSelected={hasChatSelected} />
        <ChatLayoutMain hasChatSelected={hasChatSelected}>
          {children ?? <ChatWindowEmpty />}
        </ChatLayoutMain>
      </div>
    </div>
  );
}

export function ChatLayoutSidebar({
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"aside"> & { hasChatSelected?: boolean }) {
  return (
    <aside
      className={cn(
        "bg-background w-full shrink-0 border-r md:w-[345px] flex",
        hasChatSelected && "hidden md:flex", // Hide on mobile when chat is selected
        className,
      )}
      {...props}
    >
      <ChatSidebar />
    </aside>
  );
}

export function ChatLayoutMain({
  children,
  hasChatSelected = false,
  className,
  ...props
}: React.ComponentProps<"main"> & { hasChatSelected?: boolean }) {
  return (
    <main
      className={cn(
        "flex flex-1 flex-col overflow-hidden",
        !hasChatSelected && "hidden md:flex", // Hide on mobile when no chat selected
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
