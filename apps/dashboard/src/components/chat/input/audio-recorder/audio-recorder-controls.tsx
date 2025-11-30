"use client";

import { Button } from "@manylead/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@manylead/ui/tooltip";
import { Mic, Pause, Play, Send, Trash2 } from "lucide-react";

interface AudioRecorderControlsProps {
  state: "idle" | "recording" | "paused" | "previewing";
  onPause: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onSend: () => void;
  onPlayPreview: () => void;
  onPausePreview: () => void;
}

export function AudioRecorderControls({
  state,
  onPause,
  onRestart,
  onDelete,
  onSend,
  onPlayPreview,
  onPausePreview,
}: AudioRecorderControlsProps) {
  if (state === "recording") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPause}
            className="h-8 w-8 shrink-0"
          >
            <Pause className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Pausar gravação</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Previewing state
  if (state === "previewing") {
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Descartar áudio</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onPausePreview}
              className="h-8 w-8 shrink-0"
            >
              <Pause className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pausar preview</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSend}
              className="h-8 w-8 shrink-0 text-primary"
            >
              <Send className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Enviar áudio</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Paused state
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Descartar áudio</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRestart}
            className="h-8 w-8 shrink-0"
          >
            <Mic className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Continuar gravação</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPlayPreview}
            className="h-8 w-8 shrink-0"
          >
            <Play className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ouvir áudio</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSend}
            className="h-8 w-8 shrink-0 text-primary"
          >
            <Send className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Enviar áudio</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
