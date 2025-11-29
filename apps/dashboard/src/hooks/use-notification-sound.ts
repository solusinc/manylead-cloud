import { useCallback, useEffect, useRef } from "react";

/**
 * Hook para tocar som de notificação de mensagens
 */
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    if (audioRef.current) {
      // Reset para o início caso já esteja tocando
      audioRef.current.currentTime = 0;

      // Tocar o som
      audioRef.current.play().catch((error) => {
        // Silenciar erro se o usuário não interagiu ainda (autoplay policy)
        console.debug("Notification sound blocked:", error);
      });
    }
  }, []);

  return { playNotificationSound };
}
