import type { Server as SocketIOServer } from "socket.io";
import type { ChannelSyncEvent } from "../types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("ChannelSyncHandler");

/**
 * Handle channel sync events
 */
export function handleChannelSyncEvent(
  io: SocketIOServer,
  message: string
): void {
  try {
    const event = JSON.parse(message) as ChannelSyncEvent;
    const room = `org:${event.organizationId}`;

    log.info({ room, eventType: event.type, channelId: event.channelId }, "Broadcasting channel sync event");

    // Broadcast to all clients in the organization's room
    io.to(room).emit(event.type, {
      channelId: event.channelId,
      ...event.data,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to parse channel sync event");
  }
}
