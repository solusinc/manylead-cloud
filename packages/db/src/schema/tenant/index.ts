/**
 * Tenant Database Schemas
 *
 * Schemas para os databases isolados de cada tenant.
 * Os schemas de organization, member e invitation agora estão no catalog DB
 * gerenciados pelo Better Auth.
 */

// Organization Settings
export * from "./organization-settings";

// Departments
export * from "./departments";

// Agents
export * from "./agents";

// Channels
export * from "./channels";

// Contacts
export * from "./contacts";

// Chats
export * from "./chats";

// Messages
export * from "./messages";

// Attachments
export * from "./attachments";

// Agent Status
export * from "./agent-status";

// Tags
export * from "./tags";

// Quick Replies
export * from "./quick-replies";

// Endings
export * from "./endings";

// Scheduled Messages
export * from "./scheduled-messages";

// Chat Ratings
export * from "./chat-ratings";

// Notifications
export * from "./notifications";
