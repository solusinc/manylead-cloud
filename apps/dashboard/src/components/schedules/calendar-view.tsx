"use client";

import { useState } from "react";

import type { CalendarData } from "./calendar/types";
import { CalendarHeader } from "./calendar/calendar-header";
import { CalendarGrid } from "./calendar/calendar-grid";
import { useCalendarData } from "./calendar/use-calendar-data";

interface CalendarViewProps {
  data?: CalendarData;
  isLoading: boolean;
}

export function CalendarView({ data, isLoading }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { messagesByDate } = useCalendarData(data);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <CalendarHeader currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
      <CalendarGrid currentMonth={currentMonth} messagesByDate={messagesByDate} />
    </div>
  );
}
