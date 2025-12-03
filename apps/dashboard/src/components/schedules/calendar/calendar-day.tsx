import { format, isSameDay, isSameMonth } from "date-fns";
import { MessageSquare, StickyNote } from "lucide-react";

import { cn } from "@manylead/ui";

import type { ScheduledMessageItem } from "./types";

interface CalendarDayProps {
  date: Date;
  currentMonth: Date;
  messages: ScheduledMessageItem[];
  onDayClick?: (date: Date, contentType: "message" | "comment") => void;
}

export function CalendarDay({
  date,
  currentMonth,
  messages,
  onDayClick,
}: CalendarDayProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isToday = isSameDay(date, new Date());

  // Contar mensagens (incluindo quick replies) e notas
  const messageCount = messages.filter(
    (m) => m.scheduledMessage.contentType === "message",
  ).length;
  const noteCount = messages.filter(
    (m) => m.scheduledMessage.contentType === "comment",
  ).length;

  return (
    <div
      className={cn(
        "flex min-h-[120px] flex-col overflow-hidden border-r border-b p-2",
        !isCurrentMonth && "bg-muted/20",
        isToday && "bg-accent/30",
      )}
    >
      <div
        className={cn(
          "mb-2 text-sm",
          !isCurrentMonth && "text-muted-foreground",
          isToday && "font-bold",
        )}
      >
        {format(date, "d")}
      </div>

      <div className="flex flex-col gap-1.5 overflow-hidden">
        {/* Badge de Mensagens (incluindo Quick Replies) */}
        {messageCount > 0 && (
          <button
            type="button"
            onClick={() => onDayClick?.(date, "message")}
            className="hover:bg-muted flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors"
          >
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              <MessageSquare className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium">Mensagens</span>
            </div>
            <span className="bg-muted shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold">
              {messageCount}
            </span>
          </button>
        )}

        {/* Badge de Notas */}
        {noteCount > 0 && (
          <button
            type="button"
            onClick={() => onDayClick?.(date, "comment")}
            className="hover:bg-muted flex w-full min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors"
          >
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
              <StickyNote className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium">Notas</span>
            </div>
            <span className="bg-muted shrink-0 rounded-full border px-1.5 py-0.5 text-xs font-semibold">
              {noteCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
