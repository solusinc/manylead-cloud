import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@manylead/ui/button";

interface CalendarHeaderProps {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
}

export function CalendarHeader({ currentMonth, onMonthChange }: CalendarHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-semibold capitalize">
        {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
      </h2>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(new Date())}
        >
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
