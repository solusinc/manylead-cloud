import type { Server as SocketIOServer } from "socket.io";
import type { ChatEvent, MessageEvent, TypingEvent } from "../types";

/**
 * Handle chat events (created, updated, deleted)
 */
export function handleChatEvent(
  io: SocketIOServer,
  message: string,
): void {
  try {
    const event = JSON.parse(message) as ChatEvent;

    // Se tem targetAgentId, enviar APENAS para aquele agent
    if (event.targetAgentId) {
      const agentRoom = `agent:${event.targetAgentId}`;
      console.log(`[Chat] Sending ${event.type} to room: ${agentRoom}`);
      io.to(agentRoom).emit(event.type, event.data);
    } else {
      // Sem targetAgentId, broadcast para TODA a organização
      const room = `org:${event.organizationId}`;
      console.log(`[Chat] Broadcasting ${event.type} to room: ${room}`);
      io.to(room).emit(event.type, event.data);
    }
  } catch (error) {
    console.error("[Chat] Failed to parse event:", error);
  }
}

/**
 * Handle message events (new, updated, deleted)
 */
export function handleMessageEvent(
  io: SocketIOServer,
  message: string,
): void {
  try {
    const event = JSON.parse(message) as MessageEvent;

    // Se tem targetAgentId, enviar APENAS para aquele agent (chat interno)
    if (event.targetAgentId) {
      const agentRoom = `agent:${event.targetAgentId}`;
      console.log(`[Message] Sending ${event.type} to room: ${agentRoom} (private)`);
      io.to(agentRoom).emit(event.type, event.data);
    } else {
      // Sem targetAgentId, broadcast para TODA a organização (chat WhatsApp)
      const room = `org:${event.organizationId}`;
      console.log(`[Message] Broadcasting ${event.type} to room: ${room}`);
      io.to(room).emit(event.type, event.data);
    }
  } catch (error) {
    console.error("[Message] Failed to parse event:", error);
  }
}

/**
 * Handle typing indicator events
 */
export function handleTypingEvent(
  io: SocketIOServer,
  message: string,
): void {
  try {
    const event = JSON.parse(message) as TypingEvent;
    const room = `chat:${event.chatId}`;

    console.log(`[Typing] Broadcasting ${event.type} to room: ${room}`);

    // Broadcast to all clients in the chat room (except sender)
    io.to(room).emit(event.type, event.data);
  } catch (error) {
    console.error("[Typing] Failed to parse event:", error);
  }
}
