import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import type { ScheduledMessageItem } from "./types";
import { CalendarDay } from "./calendar-day";

interface CalendarGridProps {
  currentMonth: Date;
  messagesByDate: Map<string, ScheduledMessageItem[]>;
  onDayClick?: (date: Date, contentType: "message" | "comment") => void;
}

const WEEK_DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function CalendarGrid({ currentMonth, messagesByDate, onDayClick }: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="rounded-lg border">
      {/* Header dos dias da semana */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="p-2 text-center text-sm font-medium uppercase text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Dias do mês */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dateKey = day.toISOString().split("T")[0];
          const messages = messagesByDate.get(dateKey ?? "") ?? [];

          return (
            <CalendarDay
              key={idx}
              date={day}
              currentMonth={currentMonth}
              messages={messages}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}
