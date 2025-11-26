/**
 * Schema exports safe for client-side usage
 * Only exports types, constants, and validation schemas (no drizzle tables)
 */

// Quick Reply types and constants
export {
  QUICK_REPLY_CONTENT_TYPES,
  QUICK_REPLY_CONTENT_TYPE_LABELS,
  QUICK_REPLY_VISIBILITY,
  QUICK_REPLY_VISIBILITY_LABELS,
  QUICK_REPLY_VARIABLES,
  type QuickReplyContentType,
  type QuickReplyVisibility,
  type QuickReplyMessage,
} from "./schema/tenant/quick-replies/constants";

export {
  quickReplyMessageSchema,
  type QuickReplyMessageInput,
} from "./schema/tenant/quick-replies/validation";
