import { useState, useRef, useCallback, useEffect } from "react";

export interface UseAudioRecorderReturn {
  state: "idle" | "recording" | "paused" | "previewing";
  duration: number;
  audioBlob: Blob | null;
  waveformData: number[];
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  restartRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  playPreview: () => void;
  pausePreview: () => void;
  error: Error | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<"idle" | "recording" | "paused" | "previewing">("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const isRequestingMicRef = useRef<boolean>(false);

  // Cleanup function
  const cleanup = useCallback((stopTracks = true) => {
    // DON'T reset isRequestingMicRef here - it should only be reset in startRecording's finally
    // This prevents race conditions where cleanup between getUserMedia calls allows duplicate requests

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // CRITICAL: Disconnect source node FIRST before closing AudioContext
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      sourceNodeRef.current = null;
    }

    // Close audio context BEFORE stopping tracks
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore errors
      }
    }

    // CRITICAL: Stop all tracks to release microphone IMMEDIATELY
    if (stopTracks && streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clear refs
    mediaRecorderRef.current = null;
    analyserRef.current = null;
  }, []);

  // Extract waveform data from audio stream
  const extractWaveformData = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average amplitude (simplified waveform)
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const normalized = average / 255; // Normalize to 0-1

    setWaveformData((prev) => {
      const newData = [...prev, normalized];
      // Keep only last 50 samples for performance
      return newData.slice(-50);
    });

    const animate = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const normalized = average / 255;

      setWaveformData((prev) => {
        const newData = [...prev, normalized];
        return newData.slice(-50);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    // CRITICAL: Prevent multiple simultaneous getUserMedia calls
    if (isRequestingMicRef.current) {
      return;
    }

    // CRITICAL: Prevent multiple simultaneous recordings
    if (streamRef.current) {
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return;
    }

    // Set flag BEFORE async operation
    isRequestingMicRef.current = true;

    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = stream;

      // Create audio context and analyser for waveform
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;

      // Start waveform extraction
      extractWaveformData();

      // Create media recorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128kbps
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Create blob whenever we have data (for preview)
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          setAudioBlob(blob);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        // Don't call cleanup here - it's called directly in stop/cancel functions
      };

      mediaRecorder.onerror = () => {
        setError(new Error("Recording error occurred"));
        cleanup();
      };

      // Start recording
      mediaRecorder.start();
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      setState("recording");

      // Update duration every second
      intervalRef.current = setInterval(() => {
        // Defensive check: ensure we're still recording
        if (mediaRecorderRef.current?.state !== "recording") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return;
        }

        const elapsed = Math.floor((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at 5 minutes (300 seconds)
        if (elapsed >= 300 && stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }, 1000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording");

      // Handle specific errors
      if (error.name === "NotAllowedError") {
        setError(new Error("Microphone permission denied"));
      } else if (error.name === "NotFoundError") {
        setError(new Error("No microphone found"));
      } else {
        setError(error);
      }

      cleanup();
    } finally {
      // CRITICAL: Reset flag after getUserMedia completes (success or error)
      isRequestingMicRef.current = false;
    }
  }, [cleanup, extractWaveformData]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      // Request data before pausing to have blob available for preview
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.pause();

      // Stop duration timer FIRST
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Save the current elapsed time (in milliseconds)
      pausedTimeRef.current = Date.now() - startTimeRef.current;

      // Update duration one last time before pausing
      const pausedDuration = Math.floor(pausedTimeRef.current / 1000);
      setDuration(pausedDuration);

      // Stop waveform updates
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // CRITICAL: Disconnect source node FIRST
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // Ignore errors
        }
        sourceNodeRef.current = null;
      }

      // Close audio context BEFORE stopping tracks
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // IMPORTANT: Stop tracks to release microphone when paused
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        streamRef.current = null;
      }

      setState("paused");
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    // CRITICAL: Disconnect audio nodes FIRST
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      sourceNodeRef.current = null;
    }

    // Close AudioContext BEFORE stopping tracks
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (mediaRecorderRef.current?.state !== "inactive") {
      try {
        mediaRecorderRef.current?.requestData();
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore errors
      }
    }

    cleanup(false);
    setState("idle");
  }, [cleanup]);

  // Store stopRecording in ref for use in intervals
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();

      // Recalculate start time to continue from where we paused
      // pausedTimeRef contains the elapsed time when paused (in ms)
      startTimeRef.current = Date.now() - pausedTimeRef.current;

      // Resume waveform updates
      extractWaveformData();

      // Resume duration timer
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at 5 minutes
        if (elapsed >= 300 && stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }, 1000);

      setState("recording");
    }
  }, [extractWaveformData]);

  // Restart recording - discard current and start fresh
  const restartRecording = useCallback(async () => {
    // Cleanup current recording
    cleanup();

    // Reset all state
    setDuration(0);
    setAudioBlob(null);
    setWaveformData([]);
    setError(null);
    audioChunksRef.current = [];

    // Start new recording
    await startRecording();
  }, [cleanup, startRecording]);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    // CRITICAL: Disconnect audio nodes FIRST
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Ignore errors
      }
      sourceNodeRef.current = null;
    }

    // Close AudioContext BEFORE stopping tracks
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } catch {
        // Ignore errors
      }
    }

    cleanup(false);

    setState("idle");
    setDuration(0);
    setAudioBlob(null);
    setWaveformData([]);
    setError(null);
    audioChunksRef.current = [];
  }, [cleanup]);

  // Play preview
  const playPreview = useCallback(() => {
    if (!audioBlob) return;

    // Create audio element if it doesn't exist
    if (!previewAudioRef.current) {
      const audio = new Audio();
      previewAudioRef.current = audio;

      audio.onended = () => {
        setState("paused");
      };

      audio.onerror = () => {
        setError(new Error("Erro ao reproduzir áudio"));
        setState("paused");
      };
    }

    // Set source and play
    const url = URL.createObjectURL(audioBlob);
    previewAudioRef.current.src = url;
    void previewAudioRef.current.play();
    setState("previewing");
  }, [audioBlob]);

  // Pause preview
  const pausePreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setState("paused");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      // Cleanup preview audio
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.src = "";
        previewAudioRef.current = null;
      }
    };
  }, [cleanup]);

  return {
    state,
    duration,
    audioBlob,
    waveformData,
    startRecording,
    pauseRecording,
    resumeRecording,
    restartRecording,
    stopRecording,
    cancelRecording,
    playPreview,
    pausePreview,
    error,
  };
}
