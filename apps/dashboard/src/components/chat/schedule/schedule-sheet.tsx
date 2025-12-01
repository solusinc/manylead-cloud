"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@manylead/ui/sheet";
import { useChat } from "../providers/chat-context";

interface ScheduleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleSheet({ open, onOpenChange }: ScheduleSheetProps) {
  const { chat } = useChat();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-6 p-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Agendamentos</SheetTitle>
        </SheetHeader>

        <div className="flex-1">
          <p className="text-muted-foreground text-sm">
            Sistema de agendamentos em desenvolvimento...
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Chat ID: {chat.id}
            <br />
            Created At: {chat.createdAt.toISOString()}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
