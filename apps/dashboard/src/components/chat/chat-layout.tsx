"use client";

import { cn } from "@manylead/ui";

import { ChatSidebar } from "./sidebar";
import { ChatWindowEmpty } from "./window";
import { ChatFiltersSheet } from "./chat-filters-sheet";

export function ChatLayout({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex h-full overflow-hidden", className)} {...props}>
      <ChatLayoutSidebar />
      <ChatLayoutMain>{children ?? <ChatWindowEmpty />}</ChatLayoutMain>
    </div>
  );
}

export function ChatLayoutSidebar({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "bg-background w-full shrink-0 border-r md:w-[345px]",
        "hidden md:flex", // Hide on mobile, show on desktop
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
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      className={cn("flex flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      {children}
    </main>
  );
}
