"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UsePresenceIndicatorOptions {
  onPresenceStart?: () => void;
  onPresenceStop?: () => void;
  /**
   * Intervalo aleatório para reenviar presence (min-max em ms)
   * @default [2000, 3000] (2-3 segundos)
   */
  resendInterval?: [number, number];
  /**
   * Tempo máximo para manter presence ativo (ms)
   * @default 15000 (15 segundos)
   */
  maxDuration?: number;
  /**
   * Tempo de inatividade antes de parar presence (ms)
   * @default 3000 (3 segundos)
   */
  inactivityTimeout?: number;
}

/**
 * Hook para gerenciar indicadores de presença (typing, recording, etc)
 * com reenvio periódico e limite de tempo
 */
export function usePresenceIndicator(
  options: UsePresenceIndicatorOptions = {},
) {
  const {
    onPresenceStart,
    onPresenceStop,
    resendInterval = [2000, 3000],
    maxDuration = 15000,
    inactivityTimeout = 3000,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resendIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Limpar todos os timers
  const clearTimers = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    if (resendIntervalRef.current) {
      clearTimeout(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
  }, []);

  // Parar presence
  const stop = useCallback(() => {
    if (isActive) {
      clearTimers();
      setIsActive(false);
      startTimeRef.current = null;
      onPresenceStop?.();
    }
  }, [isActive, clearTimers, onPresenceStop]);

  // Agendar próximo reenvio de presence
  const scheduleNextResend = useCallback(() => {
    const [min, max] = resendInterval;
    const randomDelay = min + Math.random() * (max - min);
    const elapsed = Date.now() - (startTimeRef.current ?? 0);

    // Se ultrapassou o limite máximo, parar
    if (elapsed >= maxDuration) {
      stop();
      return;
    }

    resendIntervalRef.current = setTimeout(() => {
      if (startTimeRef.current) {
        // Ainda ativo, reenviar
        onPresenceStart?.();
        scheduleNextResend();
      }
    }, randomDelay);
  }, [resendInterval, maxDuration, stop, onPresenceStart]);

  // Iniciar ou atualizar presence
  const trigger = useCallback(() => {
    const wasActive = isActive;

    // Se não estava ativo, iniciar
    if (!wasActive) {
      setIsActive(true);
      startTimeRef.current = Date.now();
      onPresenceStart?.();
      scheduleNextResend();
    }

    // Reset timeout de inatividade
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      stop();
    }, inactivityTimeout);
  }, [isActive, onPresenceStart, scheduleNextResend, stop, inactivityTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      if (isActive) {
        onPresenceStop?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isActive,
    trigger,
    stop,
  };
}
