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
      console.log("[Socket.io] Already connected, skipping reconnection");
      return;
    }

    console.log("[Socket.io] Connecting to:", env.NEXT_PUBLIC_SOCKET_URL);

    // Get session token for authentication
    const result = await authClient.getSession();
    const token = result.data?.session.token;

    if (!token) {
      console.error("[Socket.io] No authentication token available");
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
      console.log("[Socket.io] Connected:", socket.id);
      setIsConnected(true);

      // Entrar na room da organização
      socket.emit("join:organization", organizationId);
      console.log("[Socket.io] Joined room:", `org:${organizationId}`);
    });

    socket.on("disconnect", () => {
      console.log("[Socket.io] Disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket.io] Connection error:", err);
      setIsConnected(false);
    });

    // Handler de confirmação de entrada na room
    socket.on(
      "joined",
      ({ room }: { room: string; organizationId: string }) => {
        console.log("[Socket.io] Successfully joined room:", room);
      },
    );

    // Handlers de eventos de provisioning
    socket.on("provisioning:progress", (data: ProvisioningProgress) => {
      console.log("[Socket.io] Progress:", data);
      setProgress(data);
      setError(null);
    });

    socket.on("provisioning:complete", (data: ProvisioningComplete) => {
      console.log("[Socket.io] Complete:", data);
      setProgress({
        progress: data.progress,
        currentStep: data.currentStep,
        message: data.message,
      });
      setIsComplete(true);
      setError(null);
    });

    socket.on("provisioning:error", (data: ProvisioningError) => {
      console.error("[Socket.io] Error:", data);
      setError(data);
      setIsComplete(false);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      console.log("[Socket.io] Disconnecting...");
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
