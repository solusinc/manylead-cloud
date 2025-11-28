import { createLogger } from "~/libs/utils/logger";

const log = createLogger("MessageStatusService");

/**
 * Message Status Service
 *
 * Maps Evolution API status codes to internal message status enum.
 * Handles status transitions and validation.
 */
export class MessageStatusService {
  /**
   * Maps Evolution API status code to internal status
   *
   * Evolution API status codes:
   * - 1 = PENDING
   * - 2 = SERVER_ACK (sent)
   * - 3 = DELIVERY_ACK (delivered)
   * - 4 = READ (read)
   * - 5 = PLAYED (audio/video played)
   *
   * @param statusCode - Status code from Evolution API
   * @returns Internal message status
   */
  mapStatusCode(statusCode: number): MessageStatus | null {
    switch (statusCode) {
      case 2:
        return "sent";
      case 3:
        return "delivered";
      case 4:
        return "read";
      default:
        log.warn({ statusCode }, "Unknown status code");
        return null;
    }
  }

  /**
   * Extracts status code from Evolution API message object
   *
   * @param messageObj - Message object from Evolution API
   * @returns Status code or null if not found
   */
  extractStatusCode(messageObj: Record<string, unknown> | undefined): number | null {
    if (!messageObj) return null;

    const status = messageObj.status;
    if (typeof status === "number") {
      return status;
    }

    if (typeof status === "string") {
      const parsed = Number(status);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  /**
   * Creates update data object for status transition
   *
   * @param newStatus - New message status
   * @returns Update data with timestamps
   */
  createStatusUpdateData(newStatus: MessageStatus): StatusUpdateData {
    const updateData: StatusUpdateData = {
      status: newStatus,
    };

    if (newStatus === "delivered") {
      updateData.deliveredAt = new Date();
    }

    if (newStatus === "read") {
      updateData.readAt = new Date();
    }

    return updateData;
  }
}

/**
 * Message status enum (matches DB schema)
 */
export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

/**
 * Status update data
 */
export interface StatusUpdateData {
  status: MessageStatus;
  deliveredAt?: Date;
  readAt?: Date;
}
