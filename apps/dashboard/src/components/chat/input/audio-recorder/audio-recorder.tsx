"use client";

import { useEffect, useRef } from "react";
import { Circle } from "lucide-react";
import { toast } from "sonner";

import { useAudioRecorder } from "../hooks/use-audio-recorder";
import { AudioRecorderControls } from "./audio-recorder-controls";
import { AudioRecorderTimer } from "./audio-recorder-timer";
import { AudioRecorderWaveform } from "./audio-recorder-waveform";

interface AudioRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

export function AudioRecorder({ onSend, onCancel, onPause, onResume }: AudioRecorderProps) {
  const {
    state,
    duration,
    audioBlob,
    waveformData,
    startRecording,
    pauseRecording,
    restartRecording,
    stopRecording,
    cancelRecording,
    playPreview,
    pausePreview,
    error,
  } = useAudioRecorder();

  // Start recording on mount - must be in useLayoutEffect to preserve user gesture
  useEffect(() => {
    void startRecording();
  }, [startRecording]);

  // Track previous state to detect pause/resume transitions
  const prevStateRef = useRef(state);

  // Notify parent when paused/resumed
  useEffect(() => {
    const prevState = prevStateRef.current;

    // Só notifica se houve transição (não na montagem)
    if (prevState !== state) {
      if (state === "paused") {
        onPause?.();
      } else if (state === "recording" && prevState === "paused") {
        onResume?.();
      }
    }

    prevStateRef.current = state;
  }, [state, onPause, onResume]);

  // Handle error
  useEffect(() => {
    if (error) {
      toast.error("Erro ao gravar áudio", {
        description: error.message,
      });
      onCancel();
    }
  }, [error, onCancel]);

  // Handle send
  const handleSend = () => {
    stopRecording();

    // Wait for blob to be ready
    setTimeout(() => {
      if (audioBlob) {
        onSend(audioBlob, duration);
      }
    }, 100);
  };

  // Handle delete
  const handleDelete = () => {
    cancelRecording();
    onCancel();
  };

  return (
    <div className="flex w-full items-center gap-1.5 py-2">
      {state === "recording" && (
        <>
          <Circle className="h-4 w-4 shrink-0 animate-pulse fill-red-500 text-red-500" />
          <AudioRecorderTimer duration={duration} className="min-w-12" />
        </>
      )}

      <AudioRecorderWaveform
        waveformData={waveformData}
        isRecording={state === "recording"}
        className="min-w-0 flex-1"
      />

      {(state === "paused" || state === "previewing") && (
        <AudioRecorderTimer duration={duration} className="min-w-12" />
      )}

      <AudioRecorderControls
        state={state}
        onPause={pauseRecording}
        onRestart={restartRecording}
        onDelete={handleDelete}
        onSend={handleSend}
        onPlayPreview={playPreview}
        onPausePreview={pausePreview}
      />
    </div>
  );
}
