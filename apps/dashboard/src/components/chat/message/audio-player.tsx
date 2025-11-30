"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaUser } from "react-icons/fa";
import { Button } from "@manylead/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@manylead/ui/avatar";
import { useTheme } from "@manylead/ui/theme";
import { Play, Pause } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { useChat } from "../providers/chat-context";
import { useTRPC } from "~/lib/trpc/react";

interface AudioPlayerProps {
  src: string;
  duration?: number | null;
  onTimeUpdate?: (currentTime: number, isPlaying: boolean) => void;
  isOwnMessage?: boolean;
}

export function AudioPlayer({ src, onTimeUpdate, isOwnMessage = false }: AudioPlayerProps) {
  const { chat } = useChat();
  const trpc = useTRPC();
  const { themeMode } = useTheme();
  const { data: currentOrg } = useQuery(
    trpc.organization.getCurrent.queryOptions(),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep ref updated with latest callback
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Cores diferentes para incoming/outgoing e light/dark
    const waveColors = themeMode === "dark"
      ? isOwnMessage
        ? { waveColor: "#4d8d81", progressColor: "#99beb7" } // Outgoing dark
        : { waveColor: "#636b70", progressColor: "#a6abad" } // Incoming dark
      : isOwnMessage
        ? { waveColor: "#b0ceae", progressColor: "#728977" } // Outgoing light
        : { waveColor: "#ced0d1", progressColor: "#858a8d" }; // Incoming light

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveColors.waveColor,
      progressColor: waveColors.progressColor,
      cursorColor: "transparent",
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height: 28,
      normalize: true,
      url: src,
    });

    wavesurferRef.current = wavesurfer;

    // Event listeners
    wavesurfer.on("play", () => {
      setIsPlaying(true);
      const currentTime = Math.floor(wavesurfer.getCurrentTime());
      onTimeUpdateRef.current?.(currentTime, true);
    });
    wavesurfer.on("pause", () => {
      setIsPlaying(false);
      const currentTime = Math.floor(wavesurfer.getCurrentTime());
      onTimeUpdateRef.current?.(currentTime, false);
    });
    wavesurfer.on("timeupdate", (time) => {
      const currentTime = Math.floor(time);
      onTimeUpdateRef.current?.(currentTime, true);
    });
    wavesurfer.on("finish", () => {
      setIsPlaying(false);
      onTimeUpdateRef.current?.(0, false);
    });

    // Cleanup
    return () => {
      wavesurfer.destroy();
    };
  }, [src]);

  const handlePlayPause = useCallback(() => {
    if (!wavesurferRef.current) return;
    void wavesurferRef.current.playPause();
  }, []);

  // Decidir qual avatar mostrar baseado em quem enviou a mensagem
  const avatarSrc = isOwnMessage ? currentOrg?.logo ?? undefined : chat.contact.avatar ?? undefined;

  return (
    <div className="flex items-center gap-2 py-1">
      <Avatar className="size-10 shrink-0 rounded-full">
        {avatarSrc ? (
          <AvatarImage src={avatarSrc} alt={isOwnMessage ? currentOrg?.name : chat.contact.name} />
        ) : (
          <AvatarFallback className="bg-muted text-muted-foreground rounded-full">
            <FaUser className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handlePlayPause}
        className="size-10 shrink-0 text-black hover:!bg-transparent dark:text-white dark:hover:!bg-transparent"
      >
        {isPlaying ? (
          <Pause className="size-5 fill-current" />
        ) : (
          <Play className="size-5 fill-current" />
        )}
      </Button>

      <div ref={containerRef} className="flex-1" style={{ minWidth: '200px' }} />
    </div>
  );
}
