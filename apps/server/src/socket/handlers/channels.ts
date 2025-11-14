import type { Server as SocketIOServer } from "socket.io";
import type { ChannelQREvent } from "../types";

/**
 * Handle channel QR Code events from Baileys worker
 */
export function handleChannelEvent(
  io: SocketIOServer,
  message: string
): void {
  try {
    const event = JSON.parse(message) as ChannelQREvent;
    const room = `org:${event.organizationId}`;

    console.log(
      `[Channels] Broadcasting ${event.type} to room: ${room}`,
      {
        channelId: event.channelId,
        hasQR: !!event.data.qrCode,
        status: event.data.status,
      }
    );

    // Broadcast to all clients in the organization's room
    io.to(room).emit(event.type, {
      channelId: event.channelId,
      ...event.data,
    });
  } catch (error) {
    console.error("[Channels] Failed to parse event:", error);
  }
}
