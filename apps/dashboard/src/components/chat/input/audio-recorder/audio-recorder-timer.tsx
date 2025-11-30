"use client";

import { cn } from "@manylead/ui";
import { formatDuration } from "@manylead/shared/constants";

interface AudioRecorderTimerProps {
  duration: number;
  className?: string;
}

export function AudioRecorderTimer({ duration, className }: AudioRecorderTimerProps) {
  return (
    <span className={cn("shrink-0 font-mono text-sm text-foreground", className)}>
      {formatDuration(duration)}
    </span>
  );
}
