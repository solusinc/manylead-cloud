import type { Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { authClient } from "~/lib/auth/client";
import { env } from "~/env";

export interface ChatCreatedEvent {
  chat: Record<string, unknown>;
  contact?: Record<string, unknown>;
}

export interface ChatUpdatedEvent {
  chat: Record<string, unknown>;
}

export interface ChatDeletedEvent {
  chatId: string;
}

export interface MessageNewEvent {
  message: Record<string, unknown>;
}

export interface MessageUpdatedEvent {
  message: Record<string, unknown>;
}

export interface MessageDeletedEvent {
  messageId: string;
  timestamp: string;
}

export interface TypingStartEvent {
  chatId: string;
  agentId: string;
  agentName: string;
}

export interface TypingStopEvent {
  chatId: string;
  agentId: string;
}

export interface UseChatSocketReturn {
  // Connection state
  isConnected: boolean;

  // Methods
  connect: (organizationId: string) => Promise<void>;
  disconnect: () => void;

  // Event listeners
  onChatCreated: (callback: (data: ChatCreatedEvent) => void) => () => void;
  onChatUpdated: (callback: (data: ChatUpdatedEvent) => void) => () => void;
  onChatDeleted: (callback: (data: ChatDeletedEvent) => void) => () => void;
  onMessageNew: (callback: (data: MessageNewEvent) => void) => () => void;
  onMessageUpdated: (callback: (data: MessageUpdatedEvent) => void) => () => void;
  onMessageDeleted: (callback: (data: MessageDeletedEvent) => void) => () => void;
  onTypingStart: (callback: (data: TypingStartEvent) => void) => () => void;
  onTypingStop: (callback: (data: TypingStopEvent) => void) => () => void;

  // Typing indicators
  emitTypingStart: (chatId: string) => void;
  emitTypingStop: (chatId: string) => void;
}

/**
 * Hook para gerenciar conexão Socket.io e eventos de chat em tempo real
 *
 * Eventos escutados:
 * - chat:created - Novo chat criado
 * - chat:updated - Chat atualizado
 * - chat:deleted - Chat deletado
 * - message:new - Nova mensagem recebida
 * - message:updated - Mensagem atualizada (status, etc)
 * - message:deleted - Mensagem deletada
 * - typing:start - Usuário começou a digitar
 * - typing:stop - Usuário parou de digitar
 */
export function useChatSocket(): UseChatSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Event listener helpers
  const onChatCreated = (callback: (data: ChatCreatedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("chat:created", callback);
    return () => {
      socketRef.current?.off("chat:created", callback);
    };
  };

  const onChatUpdated = (callback: (data: ChatUpdatedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("chat:updated", callback);
    return () => {
      socketRef.current?.off("chat:updated", callback);
    };
  };

  const onChatDeleted = (callback: (data: ChatDeletedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("chat:deleted", callback);
    return () => {
      socketRef.current?.off("chat:deleted", callback);
    };
  };

  const onMessageNew = (callback: (data: MessageNewEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("message:new", callback);
    return () => {
      socketRef.current?.off("message:new", callback);
    };
  };

  const onMessageUpdated = (callback: (data: MessageUpdatedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("message:updated", callback);
    return () => {
      socketRef.current?.off("message:updated", callback);
    };
  };

  const onMessageDeleted = (callback: (data: MessageDeletedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("message:deleted", callback);
    return () => {
      socketRef.current?.off("message:deleted", callback);
    };
  };

  const onTypingStart = (callback: (data: TypingStartEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("typing:start", callback);
    return () => {
      socketRef.current?.off("typing:start", callback);
    };
  };

  const onTypingStop = (callback: (data: TypingStopEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("typing:stop", callback);
    return () => {
      socketRef.current?.off("typing:stop", callback);
    };
  };

  // Emit typing events
  const emitTypingStart = (chatId: string) => {
    console.log("[useChatSocket] emitTypingStart:", {
      chatId,
      socketExists: !!socketRef.current,
      isConnected: socketRef.current?.connected
    });
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing:start", { chatId });
      console.log("[useChatSocket] ✓ typing:start emitted");
    } else {
      console.log("[useChatSocket] ✗ Socket not connected, cannot emit typing:start");
    }
  };

  const emitTypingStop = (chatId: string) => {
    console.log("[useChatSocket] emitTypingStop:", {
      chatId,
      socketExists: !!socketRef.current,
      isConnected: socketRef.current?.connected
    });
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing:stop", { chatId });
      console.log("[useChatSocket] ✓ typing:stop emitted");
    } else {
      console.log("[useChatSocket] ✗ Socket not connected, cannot emit typing:stop");
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
    connect,
    disconnect,
    onChatCreated,
    onChatUpdated,
    onChatDeleted,
    onMessageNew,
    onMessageUpdated,
    onMessageDeleted,
    onTypingStart,
    onTypingStop,
    emitTypingStart,
    emitTypingStop,
  };
}
