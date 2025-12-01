"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { FaUser, FaWhatsapp } from "react-icons/fa";

import { cn } from "@manylead/ui";
import { Avatar, AvatarFallback } from "@manylead/ui/avatar";

import { ContactDetailsSheet } from "../contact";
import { ChatSearchSheet } from "./chat-search-sheet";
import { ChatStarredSheet } from "./chat-starred-sheet";
import { ChatHistorySheet } from "./chat-history-sheet";
import { ChatWindowHeaderActions } from "./chat-window-header-actions";
import { ChatImagesProvider } from "../message/chat-images-context";
import { ScheduleSheet } from "../schedule";

interface ChatWindowHeaderProps {
  chat: {
    id: string;
    createdAt: Date;
    contact: {
      id: string;
      name: string;
      phoneNumber: string;
      avatar: string | null;
      instanceCode?: string;
      customName?: string | null;
      notes?: string | null;
      customFields?: Record<string, string> | null;
    };
    status: "open" | "closed";
    assignedTo: string | null;
    source?: "whatsapp" | "internal";
  };
  className?: string;
}

export function ChatWindowHeader({
  chat,
  className,
  ...props
}: ChatWindowHeaderProps & React.ComponentProps<"div">) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [starredOpen, setStarredOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const contactDisplayName = chat.contact.customName ?? chat.contact.name;

  return (
    <>
      <div
        className={cn(
          "bg-background flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 shadow-sm",
          className
        )}
        {...props}
      >
        <ChatWindowHeaderInfo
          contact={chat.contact}
          source={chat.source}
          onClick={() => setDetailsOpen(true)}
        />
        <ChatWindowHeaderActions
          chat={chat}
          chatId={chat.id}
          chatCreatedAt={chat.createdAt}
          onOpenDetails={() => setDetailsOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenStarred={() => setStarredOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSchedule={() => setScheduleOpen(true)}
        />
      </div>

      <ContactDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        contact={chat.contact}
        source={chat.source}
      />

      <ChatSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        chatId={chat.id}
        contactName={contactDisplayName}
      />

      <ChatImagesProvider>
        <ChatStarredSheet
          open={starredOpen}
          onOpenChange={setStarredOpen}
          chatId={chat.id}
        />
      </ChatImagesProvider>

      <ChatHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        contactId={chat.contact.id}
        currentChatId={chat.id}
      />

      <ScheduleSheet open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </>
  );
}

export const ChatWindowHeaderInfo = memo(function ChatWindowHeaderInfo({
  contact,
  source = "whatsapp",
  isTyping = false,
  className,
  onClick,
}: {
  contact: {
    name: string;
    phoneNumber: string;
    avatar: string | null;
    customName?: string | null;
  };
  source?: "whatsapp" | "internal";
  isTyping?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const displayName = contact.customName ?? contact.name;

  return (
    <button onClick={onClick} className={cn("flex cursor-pointer items-center gap-3", className)}>
      <Avatar className="h-10 w-10 border">
        {contact.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={contact.avatar} alt={displayName} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground">
            <FaUser className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{displayName}</h3>
          {source === "whatsapp" ? (
            <FaWhatsapp className="h-4 w-4" />
          ) : (
            <>
              <Image
                src="/assets/manylead-icon-light.png"
                alt="ManyLead"
                width={16}
                height={16}
                className="dark:hidden"
              />
              <Image
                src="/assets/manylead-icon-dark.png"
                alt="ManyLead"
                width={16}
                height={16}
                className="hidden dark:block"
              />
            </>
          )}
        </div>
        {isTyping && <p className="text-muted-foreground text-xs">digitando...</p>}
      </div>
    </button>
  );
});
