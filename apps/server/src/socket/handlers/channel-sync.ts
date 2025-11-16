import type { Server as SocketIOServer } from "socket.io";
import type { ChannelSyncEvent } from "../types";

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

    console.log(
      `[Channel Sync] Broadcasting ${event.type} to room: ${room}`
    );

    // Broadcast to all clients in the organization's room
    io.to(room).emit(event.type, {
      channelId: event.channelId,
      ...event.data,
    });
  } catch (error) {
    console.error("[Channel Sync] Failed to parse event:", error);
  }
}
