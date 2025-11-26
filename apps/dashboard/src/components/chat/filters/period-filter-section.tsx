"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Calendar } from "@manylead/ui/calendar";

import type { DateRange } from "@manylead/ui/calendar";
import type { PeriodFilter } from "~/stores/use-chat-filters-store";

interface PeriodFilterSectionProps {
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}

export function PeriodFilterSection({
  period,
  onPeriodChange,
}: PeriodFilterSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasPeriod = period.from !== undefined || period.to !== undefined;

  const handleSelect = (range: DateRange | undefined) => {
    onPeriodChange({
      from: range?.from,
      to: range?.to,
    });
  };

  const handleClear = () => {
    onPeriodChange({ from: undefined, to: undefined });
  };

  const formatPeriodLabel = () => {
    if (!period.from && !period.to) return null;

    const fromStr = period.from
      ? format(period.from, "dd/MM/yy", { locale: ptBR })
      : "...";
    const toStr = period.to
      ? format(period.to, "dd/MM/yy", { locale: ptBR })
      : "...";

    return `${fromStr} - ${toStr}`;
  };

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Período</span>
          {hasPeriod && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full px-1.5">
              1
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="pb-4 space-y-3">
          {/* Mostrar período selecionado */}
          {hasPeriod && (
            <div className="flex items-center justify-between bg-accent/50 rounded-md px-3 py-2">
              <span className="text-sm">{formatPeriodLabel()}</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Calendário */}
          <div className="flex justify-center">
            <Calendar
              mode="range"
              selected={{ from: period.from, to: period.to }}
              onSelect={handleSelect}
              numberOfMonths={1}
              locale={ptBR}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
