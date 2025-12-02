import { format } from "date-fns";
import { MessageSquare, StickyNote } from "lucide-react";

import { cn } from "@manylead/ui";

import type { ScheduledMessageItem } from "./types";

interface ScheduledMessageBadgeProps {
  message: ScheduledMessageItem;
}

export function ScheduledMessageBadge({ message }: ScheduledMessageBadgeProps) {
  const isMessage = message.scheduledMessage.contentType === "message";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
        isMessage
          ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
      )}
    >
      {isMessage ? (
        <MessageSquare className="h-3 w-3 flex-shrink-0" />
      ) : (
        <StickyNote className="h-3 w-3 flex-shrink-0" />
      )}
      <span className="truncate">
        {format(new Date(message.scheduledMessage.scheduledAt), "HH:mm")}
      </span>
    </div>
  );
}
