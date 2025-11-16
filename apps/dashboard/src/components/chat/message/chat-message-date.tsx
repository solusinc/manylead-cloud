"use client";

import { cn } from "@manylead/ui";
import { format, isToday, isYesterday } from "date-fns";
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
        "flex items-center justify-center my-4",
        className
      )}
      {...props}
    >
      <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border">
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

  return format(date, "dd 'de' MMMM", { locale: ptBR });
}
