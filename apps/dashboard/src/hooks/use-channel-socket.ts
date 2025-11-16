import type { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { authClient } from "~/lib/auth/client";
import { env } from "~/env";

export interface ChannelQRCodeEvent {
  channelId: string;
  qrCode: string; // base64 image
}

export interface ChannelStatusEvent {
  channelId: string;
  status: string; // pending | connected | disconnected | error
  connectionState?: string; // open | close | connecting
  phoneNumber?: string;
  displayName?: string;
  profilePictureUrl?: string;
  errorMessage?: string;
}

export interface ChannelConnectedEvent {
  channelId: string;
  phoneNumber: string;
  displayName: string;
  profilePictureUrl?: string;
}

export interface ChannelPairingCodeEvent {
  channelId: string;
  pairingCode: string; // 8-digit code like "WZYEH1YY"
}

interface UseChannelSocketReturn {
  // Connection state
  isConnected: boolean;

  // Real-time data
  qrCode: string | null;
  pairingCode: string | null;
  status: string | null;
  connectionState: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  errorMessage: string | null;

  // Methods
  connect: (organizationId: string) => Promise<void>;
  disconnect: () => void;
  reset: () => void;
}

/**
 * Hook para gerenciar conexão Socket.io e eventos de canais em tempo real
 *
 * Eventos escutados:
 * - channel:qrcode - QR Code atualizado
 * - channel:status - Status da conexão mudou
 * - channel:connected - Canal conectado com sucesso
 * - channel:pairing - Código de pairing gerado
 */
export function useChannelSocket(): UseChannelSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connect = async (organizationId: string) => {
    // Se já estiver conectado, não reconectar
    if (socketRef.current?.connected) {
      return;
    }

    // Get session token for authentication
    const result = await authClient.getSession();
    const token = result.data?.session.token;

    if (!token) {
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

    // Handlers de eventos de canal
    socket.on("channel:qrcode", (data: ChannelQRCodeEvent) => {
      setQrCode(data.qrCode);
      setErrorMessage(null);
    });

    socket.on("channel:pairing", (data: ChannelPairingCodeEvent) => {
      setPairingCode(data.pairingCode);
      setErrorMessage(null);
    });

    socket.on("channel:status", (data: ChannelStatusEvent) => {
      setStatus(data.status);
      setConnectionState(data.connectionState ?? null);
      if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
      if (data.displayName) setDisplayName(data.displayName);
      if (data.profilePictureUrl)
        setProfilePictureUrl(data.profilePictureUrl);
      if (data.errorMessage) setErrorMessage(data.errorMessage);
    });

    socket.on("channel:connected", (data: ChannelConnectedEvent) => {
      setStatus("connected");
      setPhoneNumber(data.phoneNumber);
      setDisplayName(data.displayName);
      setProfilePictureUrl(data.profilePictureUrl ?? null);
      setErrorMessage(null);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const reset = () => {
    setQrCode(null);
    setPairingCode(null);
    setStatus(null);
    setConnectionState(null);
    setPhoneNumber(null);
    setDisplayName(null);
    setProfilePictureUrl(null);
    setErrorMessage(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    qrCode,
    pairingCode,
    status,
    connectionState,
    phoneNumber,
    displayName,
    profilePictureUrl,
    errorMessage,
    connect,
    disconnect,
    reset,
  };
}
