import { useCallback } from "react";

/**
 * Hook para deduplicação de mensagens usando Map com TTL
 *
 * Mantém um Set em memória com IDs de mensagens processadas recentemente.
 * Usado para evitar duplicação quando:
 * - Optimistic update adiciona mensagem
 * - Socket retorna a mesma mensagem rapidamente
 * - HMR cria múltiplas instâncias do componente (desenvolvimento)
 *
 * Pattern: WhatsApp/Telegram/Discord deduplication
 *
 * IMPORTANTE: Singleton global para funcionar entre múltiplas instâncias (HMR)
 */

const DEDUP_TTL_MS = 60000; // 60 segundos
const CLEANUP_INTERVAL_MS = 5000; // 5 segundos

// SINGLETON: Global dedup store (persiste entre HMR)
// Map<messageId, timestamp>
const globalProcessedIds = new Map<string, number>();

// Auto-cleanup interval (run once globally)
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    globalProcessedIds.forEach((timestamp, id) => {
      if (now - timestamp > DEDUP_TTL_MS) {
        globalProcessedIds.delete(id);
      }
    });
  }, CLEANUP_INTERVAL_MS);
}

export function useMessageDeduplication() {
  /**
   * Registrar ID como processado
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const register = useCallback((id: string) => {
    globalProcessedIds.set(id, Date.now());
  }, []);

  /**
   * Verificar se ID já foi processado
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const isProcessed = useCallback((id: string): boolean => {
    return globalProcessedIds.has(id);
  }, []);

  /**
   * Verificar se algum dos IDs fornecidos já foi processado (OU lógico)
   * Útil para verificar tempId OU serverId
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const isAnyProcessed = useCallback((ids: (string | undefined)[]): boolean => {
    return ids.some((id) => id && globalProcessedIds.has(id));
  }, []);

  return {
    register,
    isProcessed,
    isAnyProcessed,
  };
}
