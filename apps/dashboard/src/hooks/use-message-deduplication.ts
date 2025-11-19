import { useRef, useEffect, useCallback } from "react";

/**
 * Hook para deduplicação de mensagens usando Map com TTL
 *
 * Mantém um Set em memória com IDs de mensagens processadas recentemente.
 * Usado para evitar duplicação quando:
 * - Optimistic update adiciona mensagem
 * - Socket retorna a mesma mensagem rapidamente
 *
 * Pattern: WhatsApp/Telegram/Discord deduplication
 */

const DEDUP_TTL_MS = 60000; // 60 segundos
const CLEANUP_INTERVAL_MS = 5000; // 5 segundos

export function useMessageDeduplication() {
  // Map<messageId, timestamp>
  const processedIds = useRef(new Map<string, number>());

  /**
   * Registrar ID como processado
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const register = useCallback((id: string) => {
    processedIds.current.set(id, Date.now());
  }, []);

  /**
   * Verificar se ID já foi processado
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const isProcessed = useCallback((id: string): boolean => {
    return processedIds.current.has(id);
  }, []);

  /**
   * Verificar se algum dos IDs fornecidos já foi processado (OU lógico)
   * Útil para verificar tempId OU serverId
   * Memoized com useCallback para evitar re-renders desnecessários
   */
  const isAnyProcessed = useCallback((ids: (string | undefined)[]): boolean => {
    return ids.some((id) => id && processedIds.current.has(id));
  }, []);

  /**
   * Limpar IDs expirados (TTL)
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      processedIds.current.forEach((timestamp, id) => {
        if (now - timestamp > DEDUP_TTL_MS) {
          processedIds.current.delete(id);
        }
      });
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return {
    register,
    isProcessed,
    isAnyProcessed,
  };
}
