/**
 * Chat Services
 *
 * Barrel exports para facilitar imports
 */

// Types
export * from "./chat.types";
export type { ChatListItem, ChatListResult } from "./chat-query-builder.service";

// Services
export { ChatPermissionsService } from "./chat-permissions.service";
export { ChatParticipantService } from "./chat-participant.service";
export { ChatService, getChatService } from "./chat.service";
export { ChatCrossOrgService } from "./chat-cross-org.service";
export {
  ChatQueryBuilderService,
  getChatQueryBuilderService,
} from "./chat-query-builder.service";
