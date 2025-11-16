"use client";

import { useState } from "react";
import { Button } from "@manylead/ui/button";
import { MessageSquarePlus, Search } from "lucide-react";
import { NewChatDialog } from "~/components/chat/new-chat-dialog";

export function NavActions() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="icon" aria-label="Search conversations">
          <Search className="h-4 w-4" />
        </Button>
        <Button
          variant="default"
          size="sm"
          aria-label="New conversation"
          onClick={() => setDialogOpen(true)}
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Nova conversa
        </Button>
      </div>

      <NewChatDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
