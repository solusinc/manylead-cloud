import type { Server as SocketIOServer } from "socket.io";
import type { ProvisioningEvent } from "../types";
import { createLogger } from "~/libs/utils/logger";

const log = createLogger("ProvisioningHandler");

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

    log.info({ room, eventType: event.type }, "Broadcasting provisioning event");

    // Broadcast to all clients in the organization's room
    io.to(room).emit(event.type, event.data);
  } catch (error) {
    log.error({ err: error }, "Failed to parse provisioning event");
  }
}
