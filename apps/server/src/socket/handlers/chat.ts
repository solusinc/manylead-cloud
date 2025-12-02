import type { Server as SocketIOServer } from "socket.io";
import type { ChatEvent, MessageEvent, TypingEvent } from "../types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("ChatHandler");

/**
 * Handle chat events (created, updated, deleted, scheduled-message events)
 */
export function handleChatEvent(
  io: SocketIOServer,
  message: string,
): void {
  try {
    const event = JSON.parse(message) as ChatEvent;

    // Para eventos de scheduled-message, precisamos incluir chatId no payload
    let payload = event.data;
    if (event.type === "scheduled-message:cancelled" || event.type === "scheduled:sent") {
      payload = {
        ...event.data,
        chatId: event.chatId,
      };
    }

    // Se tem targetAgentId, enviar APENAS para aquele agent
    if (event.targetAgentId) {
      const agentRoom = `agent:${event.targetAgentId}`;
      log.info({ room: agentRoom, eventType: event.type }, "Sending to agent room");
      io.to(agentRoom).emit(event.type, payload);
    } else {
      // Sem targetAgentId, broadcast para TODA a organização
      const room = `org:${event.organizationId}`;
      log.info({ room, eventType: event.type }, "Broadcasting to organization");
      io.to(room).emit(event.type, payload);
    }
  } catch (error) {
    log.error({ err: error }, "Failed to parse chat event");
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
      log.info({ room: agentRoom, eventType: event.type }, "Sending to agent (private)");
      io.to(agentRoom).emit(event.type, event.data);
    } else {
      // Sem targetAgentId, broadcast para TODA a organização (chat WhatsApp)
      const room = `org:${event.organizationId}`;
      log.info({ room, eventType: event.type }, "Broadcasting message to organization");
      io.to(room).emit(event.type, event.data);
    }
  } catch (error) {
    log.error({ err: error }, "Failed to parse message event");
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

    log.info({ room, eventType: event.type }, "Broadcasting typing indicator");

    // Broadcast to all clients in the chat room (except sender)
    io.to(room).emit(event.type, event.data);
  } catch (error) {
    log.error({ err: error }, "Failed to parse typing event");
  }
}
