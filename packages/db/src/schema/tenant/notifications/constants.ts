/**
 * Tipos de notificações disponíveis
 */
export const NOTIFICATION_TYPES = {
  BILLING: "billing",
  PLAN_EXPIRING: "plan_expiring",
  MEMBER_PROMOTED: "member_promoted",
  MEMBER_REMOVED: "member_removed",
  CHAT_ASSIGNED: "chat_assigned",
  SYSTEM: "system",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/**
 * Metadata da notificação
 */
export interface NotificationMetadata {
  userId?: string;
  userName?: string;
  planName?: string;
  amount?: number;
  chatId?: string;
  contactName?: string;
  [key: string]: unknown;
}
