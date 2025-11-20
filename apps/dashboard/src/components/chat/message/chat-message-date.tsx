"use client";

import { cn } from "@manylead/ui";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ChatMessageDateDivider({
  date,
  className,
  ...props
}: {
  date: Date;
} & React.ComponentProps<"div">) {
  const formattedDate = formatMessageDate(date);

  return (
    <div
      className={cn(
        "flex items-center justify-center my-3",
        className
      )}
      {...props}
    >
      <span className="rounded-lg bg-white dark:bg-muted/50 px-3 py-1.5 text-sm font-semibold shadow-sm">
        {formattedDate}
      </span>
    </div>
  );
}

function formatMessageDate(date: Date): string {
  if (isToday(date)) {
    return "Hoje";
  }

  if (isYesterday(date)) {
    return "Ontem";
  }

  // Check if date is within this week (last 7 days)
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    // Show day of week (Segunda-feira, Terça-feira, etc.)
    return format(date, "EEEE", { locale: ptBR });
  }

  // More than 7 days: show date in DD/MM/YYYY format (WhatsApp style)
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}
