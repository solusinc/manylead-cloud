import type { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { authClient } from "~/lib/auth/client";
import { env } from "~/env";

export interface ProvisioningProgress {
  progress: number;
  currentStep: string;
  message: string;
}

export interface ProvisioningComplete {
  progress: number;
  currentStep: string;
  message: string;
  tenant: {
    id: string;
    slug: string;
    status: string;
    connectionString: string;
  };
}

export interface ProvisioningError {
  error: string;
  message: string;
}

interface UseProvisioningSocketReturn {
  isConnected: boolean;
  progress: ProvisioningProgress | null;
  error: ProvisioningError | null;
  isComplete: boolean;
  connect: (organizationId: string) => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook para gerenciar conexão Socket.io e eventos de provisioning em tempo real
 */
export function useProvisioningSocket(): UseProvisioningSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ProvisioningProgress | null>(null);
  const [error, setError] = useState<ProvisioningError | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const connect = async (organizationId: string) => {
    // Se já estiver conectado, não reconectar
    if (socketRef.current?.connected) {
      return;
    }

    // Get session token for authentication
    const result = await authClient.getSession();
    const token = result.data?.session.token;

    if (!token) {
      setError({
        error: "Authentication required",
        message: "Please log in to connect",
      });
      return;
    }

    // Criar conexão Socket.io com autenticação JWT
    const socket = io(env.NEXT_PUBLIC_SOCKET_URL, {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Handlers de conexão
    socket.on("connect", () => {
      setIsConnected(true);

      // Entrar na room da organização
      socket.emit("join:organization", organizationId);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    // Handler de confirmação de entrada na room
    socket.on(
      "joined",
      () => {
        // Silent join confirmation
      },
    );

    // Handlers de eventos de provisioning
    socket.on("provisioning:progress", (data: ProvisioningProgress) => {
      setProgress(data);
      setError(null);
    });

    socket.on("provisioning:complete", (data: ProvisioningComplete) => {
      setProgress({
        progress: data.progress,
        currentStep: data.currentStep,
        message: data.message,
      });
      setIsComplete(true);
      setError(null);
    });

    socket.on("provisioning:error", (data: ProvisioningError) => {
      setError(data);
      setIsComplete(false);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    progress,
    error,
    isComplete,
    connect,
    disconnect,
  };
}
