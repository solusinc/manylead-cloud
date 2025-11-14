import type { Server as SocketIOServer } from "socket.io";
import type { ProvisioningEvent } from "../types";

/**
 * Handle tenant provisioning events
 */
export function handleProvisioningEvent(
  io: SocketIOServer,
  message: string
): void {
  try {
    const event = JSON.parse(message) as ProvisioningEvent;
    const room = `org:${event.organizationId}`;

    console.log(
      `[Provisioning] Broadcasting ${event.type} to room: ${room}`
    );

    // Broadcast to all clients in the organization's room
    io.to(room).emit(event.type, event.data);
  } catch (error) {
    console.error("[Provisioning] Failed to parse event:", error);
  }
}
