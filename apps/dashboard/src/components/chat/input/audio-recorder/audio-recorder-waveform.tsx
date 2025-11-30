"use client";

import { useEffect, useRef } from "react";
import { cn } from "@manylead/ui";

interface AudioRecorderWaveformProps {
  waveformData: number[];
  isRecording: boolean;
  className?: string;
}

export function AudioRecorderWaveform({
  waveformData,
  isRecording,
  className,
}: AudioRecorderWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw waveform bars
    const barWidth = 3;
    const barGap = 2;
    const barCount = Math.floor(rect.width / (barWidth + barGap));
    const centerY = rect.height / 2;

    // Use last N samples that fit in canvas
    const displayData = waveformData.slice(-barCount);

    displayData.forEach((amplitude, index) => {
      const x = index * (barWidth + barGap);
      const barHeight = Math.max(4, amplitude * rect.height * 0.8); // Min 4px height

      // Color: red when recording, gray when paused
      ctx.fillStyle = isRecording ? "#ef4444" : "#6b7280";

      // Draw centered bar
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });
  }, [waveformData, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "h-12 w-full rounded",
        isRecording && "animate-pulse",
        className,
      )}
    />
  );
}
