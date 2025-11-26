"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@manylead/ui";

interface FilterAccordionProps {
  title: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  badge?: number;
  children?: React.ReactNode;
}

export function FilterAccordion({
  title,
  defaultOpen = false,
  disabled = false,
  badge,
  children,
}: FilterAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between py-4 text-left",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="text-xs bg-primary text-primary-foreground min-w-5 h-5 flex items-center justify-center rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      {isOpen && !disabled && (
        <div className="pb-4 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}
