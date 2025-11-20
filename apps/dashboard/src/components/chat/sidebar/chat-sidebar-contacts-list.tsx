"use client";

import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@manylead/ui/avatar";
import { Skeleton } from "@manylead/ui/skeleton";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTRPC } from "~/lib/trpc/react";
import { useChatSearchStore } from "~/stores/use-chat-search-store";
import { Phone, MessageSquarePlus } from "lucide-react";
import { Button } from "@manylead/ui/button";
import { NewChatDialog } from "../new-chat-dialog";

export function ChatSidebarContactsList({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const parentRef = useRef<HTMLDivElement>(null);
  const trpc = useTRPC();
  const searchTerm = useChatSearchStore((state) => state.searchTerm);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Buscar contatos da API com busca
  const { data: contactsData, isLoading } = useQuery(
    trpc.contacts.list.queryOptions({
      search: searchTerm,
      limit: 100,
      offset: 0,
    })
  );

  const contacts = contactsData?.items ?? [];

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        ref={parentRef}
        className={cn("flex-1 overflow-y-auto", className)}
        {...props}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 border-b"
          >
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (contacts.length === 0) {
    return (
      <div
        className={cn(
          "flex-1 flex items-center justify-center p-8 text-center",
          className
        )}
        {...props}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Nenhum contato encontrado
          </p>
          <p className="text-xs text-muted-foreground">
            Tente buscar por nome ou telefone
          </p>
        </div>
      </div>
    );
  }

  const handleContactClick = () => {
    setDialogOpen(true);
  };

  return (
    <>
      <div
        ref={parentRef}
        className={cn("flex-1 overflow-y-auto", className)}
        {...props}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const contact = contacts[virtualItem.index];
            if (!contact) return null;

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <ContactItem
                  contact={contact}
                  onClick={handleContactClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      <NewChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function ContactItem({
  contact,
  onClick,
}: {
  contact: {
    id: string;
    name: string;
    avatar: string | null;
    phoneNumber: string | null;
  };
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer hover:bg-accent transition-colors border-b"
      )}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={contact.avatar ?? undefined} />
        <AvatarFallback>{contact.name[0]?.toUpperCase() ?? "?"}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium truncate">{contact.name}</span>
        </div>

        {contact.phoneNumber && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span className="truncate">{contact.phoneNumber}</span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </Button>
    </div>
  );
}
