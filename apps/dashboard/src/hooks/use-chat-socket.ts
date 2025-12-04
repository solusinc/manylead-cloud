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
  message: Record<string, unknown>;
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

export interface RecordingStartEvent {
  chatId: string;
  agentId: string;
  agentName: string;
}

export interface RecordingStopEvent {
  chatId: string;
  agentId: string;
}

export interface ContactLogoUpdatedEvent {
  sourceOrganizationId: string;
  logoUrl: string | null;
  contactsUpdated: number;
}

export interface ScheduledMessageSentEvent {
  scheduledMessageId: string;
  messageId: string;
  chatId: string;
  contentType: "message" | "comment";
}

export interface ScheduledMessageCancelledEvent {
  scheduledMessageId: string;
  chatId: string;
  reason: string;
}

export interface WhatsAppMessageStatusEvent {
  messageId: string;
  chatId: string;
  status: "sent" | "delivered" | "read";
  sender: string;
  timestamp: string;
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
  onRecordingStart: (callback: (data: RecordingStartEvent) => void) => () => void;
  onRecordingStop: (callback: (data: RecordingStopEvent) => void) => () => void;
  onContactLogoUpdated: (callback: (data: ContactLogoUpdatedEvent) => void) => () => void;
  onScheduledMessageSent: (callback: (data: ScheduledMessageSentEvent) => void) => () => void;
  onScheduledMessageCancelled: (callback: (data: ScheduledMessageCancelledEvent) => void) => () => void;
  onWhatsAppMessageStatus: (callback: (data: WhatsAppMessageStatusEvent) => void) => () => void;

  // Typing indicators
  emitTypingStart: (chatId: string) => void;
  emitTypingStop: (chatId: string) => void;

  // Recording indicators
  emitRecordingStart: (chatId: string) => void;
  emitRecordingStop: (chatId: string) => void;
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
 * - recording:start - Usuário começou a gravar áudio
 * - recording:stop - Usuário parou de gravar áudio
 */
export function useChatSocket(): UseChatSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const organizationIdRef = useRef<string | null>(null);

  const connect = async (organizationId: string) => {
    // Store organizationId for reconnection
    organizationIdRef.current = organizationId;

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
      // PROFESSIONAL RECONNECTION STRATEGY (WhatsApp/Slack pattern)
      reconnection: true,
      reconnectionAttempts: Infinity, // Never give up (like WhatsApp)
      reconnectionDelay: 1000,        // Start with 1s
      reconnectionDelayMax: 5000,     // Max 5s between attempts
      timeout: 20000,                 // 20s connection timeout
    });

    socketRef.current = socket;

    // Handlers de conexão
    socket.on("connect", () => {
      setIsConnected(true);

      // CRITICAL: Re-join organization room after reconnect
      if (organizationIdRef.current) {
        socket.emit("join:organization", organizationIdRef.current);
      }
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);

      // If disconnected by server, try to reconnect manually
      if (reason === "io server disconnect") {
        socket.connect();
      }
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    socket.on("reconnect_attempt", () => {
      // Silent reconnection attempt
    });

    socket.on("reconnect", () => {
      setIsConnected(true);

      // Re-join organization room
      if (organizationIdRef.current) {
        socket.emit("join:organization", organizationIdRef.current);
      }
    });

    socket.on("reconnect_error", () => {
      // Silent reconnection error
    });

    socket.on("reconnect_failed", () => {
      // This will never happen with Infinity attempts, but kept for safety
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

  const onRecordingStart = (callback: (data: RecordingStartEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("recording:start", callback);
    return () => {
      socketRef.current?.off("recording:start", callback);
    };
  };

  const onRecordingStop = (callback: (data: RecordingStopEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("recording:stop", callback);
    return () => {
      socketRef.current?.off("recording:stop", callback);
    };
  };

  const onContactLogoUpdated = (callback: (data: ContactLogoUpdatedEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("contact:logo:updated", callback);
    return () => {
      socketRef.current?.off("contact:logo:updated", callback);
    };
  };

  const onScheduledMessageSent = (callback: (data: ScheduledMessageSentEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("scheduled:sent", callback);
    return () => {
      socketRef.current?.off("scheduled:sent", callback);
    };
  };

  const onScheduledMessageCancelled = (callback: (data: ScheduledMessageCancelledEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("scheduled-message:cancelled", callback);
    return () => {
      socketRef.current?.off("scheduled-message:cancelled", callback);
    };
  };

  const onWhatsAppMessageStatus = (callback: (data: WhatsAppMessageStatusEvent) => void) => {
    if (!socketRef.current) {
      return () => {
        // No-op
      };
    }
    socketRef.current.on("message:status", callback);
    return () => {
      socketRef.current?.off("message:status", callback);
    };
  };

  // Emit typing events
  const emitTypingStart = (chatId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing:start", { chatId });
    }
  };

  const emitTypingStop = (chatId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("typing:stop", { chatId });
    }
  };

  // Emit recording events
  const emitRecordingStart = (chatId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("recording:start", { chatId });
    }
  };

  const emitRecordingStop = (chatId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("recording:stop", { chatId });
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
    onRecordingStart,
    onRecordingStop,
    onContactLogoUpdated,
    onScheduledMessageSent,
    onScheduledMessageCancelled,
    onWhatsAppMessageStatus,
    emitTypingStart,
    emitTypingStop,
    emitRecordingStart,
    emitRecordingStop,
  };
}
