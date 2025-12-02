import { useMemo } from "react";
import { format } from "date-fns";

import type { ScheduledMessageItem, CalendarData } from "./types";

export function useCalendarData(data?: CalendarData) {
  return useMemo(() => {
    const messagesByDate = new Map<string, ScheduledMessageItem[]>();

    if (data?.items) {
      for (const item of data.items) {
        const dateKey = format(
          new Date(item.scheduledMessage.scheduledAt),
          "yyyy-MM-dd",
        );
        const existing = messagesByDate.get(dateKey) ?? [];
        messagesByDate.set(dateKey, [...existing, item]);
      }
    }

    return { messagesByDate };
  }, [data]);
}
