import { useCallback, useEffect, useRef } from "react";

import { useCurrentAgent } from "~/hooks/chat/use-current-agent";

/**
 * Hook para tocar som de notificação de mensagens
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { data: currentAgent } = useCurrentAgent();

  useEffect(() => {
    // Criar instância do áudio apenas no cliente
    audioRef.current = new Audio("/assets/messages/message-notification.mp3");
    audioRef.current.preload = "auto";

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    // Check if sounds are enabled (default to true if undefined)
    const soundsEnabled = currentAgent?.permissions.notificationSoundsEnabled ?? true;

    if (!soundsEnabled) {
      return; // Early return if sounds are disabled
    }

    if (audioRef.current) {
      // Reset para o início caso já esteja tocando
      audioRef.current.currentTime = 0;

      // Tocar o som
      audioRef.current.play().catch((error) => {
        // Silenciar erro se o usuário não interagiu ainda (autoplay policy)
        console.debug("Notification sound blocked:", error);
      });
    }
  }, [currentAgent?.permissions.notificationSoundsEnabled]);

  return { playNotificationSound };
}
