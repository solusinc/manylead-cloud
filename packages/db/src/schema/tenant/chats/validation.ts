import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { chat } from "./chat";
import { chatParticipant } from "./chat-participant";

/**
 * Chat Select schema
 */
export const selectChatSchema = createSelectSchema(chat);

/**
 * Chat Insert schema
 */
export const insertChatSchema = createInsertSchema(chat, {
  messageSource: z.enum(["whatsapp", "internal"]),
  status: z.enum(["open", "pending", "closed", "snoozed"]).default("open"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  ratingStatus: z.enum(["awaiting", "received"]).nullish(),
});

/**
 * Chat Update schema
 */
export const updateChatSchema = insertChatSchema.partial();

/**
 * ChatParticipant Select schema
 */
export const selectChatParticipantSchema = createSelectSchema(chatParticipant);

/**
 * ChatParticipant Insert schema
 */
export const insertChatParticipantSchema = createInsertSchema(chatParticipant);

/**
 * Types
 */
export type Chat = z.infer<typeof selectChatSchema>;
export type NewChat = z.infer<typeof insertChatSchema>;
export type UpdateChat = z.infer<typeof updateChatSchema>;

export type ChatParticipant = z.infer<typeof selectChatParticipantSchema>;
export type NewChatParticipant = z.infer<typeof insertChatParticipantSchema>;
