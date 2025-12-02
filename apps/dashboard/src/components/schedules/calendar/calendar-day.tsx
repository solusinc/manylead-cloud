import { format, isSameMonth, isSameDay } from "date-fns";

import { cn } from "@manylead/ui";

import type { ScheduledMessageItem } from "./types";
import { ScheduledMessageBadge } from "./scheduled-message-badge";

interface CalendarDayProps {
  date: Date;
  currentMonth: Date;
  messages: ScheduledMessageItem[];
}

export function CalendarDay({ date, currentMonth, messages }: CalendarDayProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isToday = isSameDay(date, new Date());

  return (
    <div
      className={cn(
        "min-h-[120px] border-b border-r p-2",
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

      <div className="space-y-1">
        {messages.slice(0, 3).map((message) => (
          <ScheduledMessageBadge key={message.scheduledMessage.id} message={message} />
        ))}
        {messages.length > 3 && (
          <div className="text-xs text-muted-foreground">
            +{messages.length - 3} mais
          </div>
        )}
      </div>
    </div>
  );
}
