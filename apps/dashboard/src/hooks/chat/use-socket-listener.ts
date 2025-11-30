import type { DependencyList } from "react";
import { useEffect } from "react";
import type {
  ChatCreatedEvent,
  ChatUpdatedEvent,
  ChatDeletedEvent,
  MessageNewEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  TypingStartEvent,
  TypingStopEvent,
  ContactLogoUpdatedEvent,
  UseChatSocketReturn,
} from "~/hooks/use-chat-socket";

/**
 * Type-safe mapping of socket event names to their event types
 */
interface SocketEventMap {
  onChatCreated: ChatCreatedEvent;
  onChatUpdated: ChatUpdatedEvent;
  onChatDeleted: ChatDeletedEvent;
  onMessageNew: MessageNewEvent;
  onMessageUpdated: MessageUpdatedEvent;
  onMessageDeleted: MessageDeletedEvent;
  onTypingStart: TypingStartEvent;
  onTypingStop: TypingStopEvent;
  onContactLogoUpdated: ContactLogoUpdatedEvent;
}

/**
 * Type-safe socket event listener hook with automatic cleanup
 * Follows Meta's custom hook patterns and prevents memory leaks
 *
 * @param socket - The chat socket instance from useChatSocketContext()
 * @param eventName - The socket event to listen to (e.g., 'onMessageNew')
 * @param handler - Callback function to handle the event
 * @param deps - Dependency array for the handler (defaults to [])
 * @param enabled - Whether the listener is enabled (defaults to socket.isConnected)
 *
 * @example
 * ```tsx
 * const socket = useChatSocketContext();
 *
 * useSocketListener(
 *   socket,
 *   'onMessageNew',
 *   (event) => {
 *     console.log('New message:', event.message);
 *   },
 *   [someOtherDep]
 * );
 * ```
 */
export function useSocketListener<K extends keyof SocketEventMap>(
  socket: UseChatSocketReturn,
  eventName: K,
  handler: (data: SocketEventMap[K]) => void,
  deps: DependencyList = [],
  enabled = socket.isConnected
) {
  useEffect(() => {
    // Don't subscribe if disabled or not connected
    if (!enabled) return;

    // Subscribe to the event using the socket method
    const unsubscribe = socket[eventName](handler as never);

    // Cleanup on unmount or when dependencies change
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventName, ...deps]);
}
