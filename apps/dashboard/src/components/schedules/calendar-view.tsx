"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CalendarData } from "./calendar/types";
import { CalendarHeader } from "./calendar/calendar-header";
import { CalendarGrid } from "./calendar/calendar-grid";
import { useCalendarData } from "./calendar/use-calendar-data";
import { ScheduledMessageSheet } from "./scheduled-message-sheet";
import { useTRPC } from "~/lib/trpc/react";

interface CalendarViewProps {
  data?: CalendarData;
  isLoading: boolean;
}

export function CalendarView({ data, isLoading }: CalendarViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { messagesByDate } = useCalendarData(data);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedContentType, setSelectedContentType] = useState<"message" | "comment" | null>(null);

  // Cancel mutation
  const cancelMutation = useMutation(
    trpc.scheduledMessages.cancel.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.scheduledMessages.listByOrganization.queryKey(),
        });
        toast.success("Agendamento cancelado");
      },
      onError: () => {
        toast.error("Erro ao cancelar agendamento");
      },
    }),
  );

  // Get messages for selected date and type
  const selectedMessages = useMemo(() => {
    if (!selectedDate || !selectedContentType) return [];

    const dateKey = format(selectedDate, "yyyy-MM-dd");
    const messages = messagesByDate.get(dateKey) ?? [];

    return messages.filter(m => m.scheduledMessage.contentType === selectedContentType);
  }, [selectedDate, selectedContentType, messagesByDate]);

  const handleDayClick = (date: Date, contentType: "message" | "comment") => {
    setSelectedDate(date);
    setSelectedContentType(contentType);
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    // Delay clearing to avoid flicker
    setTimeout(() => {
      setSelectedDate(null);
      setSelectedContentType(null);
    }, 300);
  };

  const handleDelete = async (messageId: string) => {
    await cancelMutation.mutateAsync({ id: messageId });
  };

  const handleUpdate = () => {
    void queryClient.invalidateQueries({
      queryKey: trpc.scheduledMessages.listByOrganization.queryKey(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <div>
        <CalendarHeader currentMonth={currentMonth} onMonthChange={setCurrentMonth} />
        <CalendarGrid
          currentMonth={currentMonth}
          messagesByDate={messagesByDate}
          onDayClick={handleDayClick}
        />
      </div>

      <ScheduledMessageSheet
        messages={selectedMessages}
        date={selectedDate}
        contentType={selectedContentType}
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
      />
    </>
  );
}
