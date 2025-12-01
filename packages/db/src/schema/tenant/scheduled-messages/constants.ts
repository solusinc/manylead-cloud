/**
 * Scheduled Message Content Types
 */
export const SCHEDULED_CONTENT_TYPES = ["message", "comment"] as const;
export type ScheduledContentType = (typeof SCHEDULED_CONTENT_TYPES)[number];

/**
 * Scheduled Message Status
 */
export const SCHEDULED_STATUS = [
  "pending",
  "processing",
  "sent",
  "failed",
  "cancelled",
] as const;
export type ScheduledStatus = (typeof SCHEDULED_STATUS)[number];

/**
 * Cancellation Reasons
 */
export const CANCELLATION_REASONS = [
  "manual",
  "contact_message",
  "agent_message",
  "chat_closed",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/**
 * Scheduled Message Metadata
 */
export interface ScheduledMessageMetadata {
  history: ScheduledMessageHistoryEntry[];
}

export interface ScheduledMessageHistoryEntry {
  action:
    | "created"
    | "updated"
    | "cancelled"
    | "sent"
    | "failed";
  agentId?: string;
  agentName?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
