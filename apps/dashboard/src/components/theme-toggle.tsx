"use client";

import type * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui";
import { cn } from "@manylead/ui";
import { Laptop, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useTheme } from "@manylead/ui/theme";

export function ThemeToggle({
  className,
  ...props
}: React.ComponentProps<typeof SelectTrigger>) {
  const { setTheme, themeMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration error prevention
  useEffect(() => {
    // This is intentionally synchronous to prevent hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Select>
        <SelectTrigger className={cn("w-[180px]", className)} {...props}>
          <SelectValue placeholder="Selecione um tema" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={themeMode} onValueChange={setTheme}>
      <SelectTrigger className={cn("w-[180px]", className)} {...props}>
        <SelectValue defaultValue={themeMode} placeholder="Selecione um tema" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span>Claro</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span>Escuro</span>
          </div>
        </SelectItem>
        <SelectItem value="auto">
          <div className="flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            <span>Automático</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
