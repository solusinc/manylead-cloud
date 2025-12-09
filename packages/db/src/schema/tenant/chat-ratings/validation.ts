import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { chatRating } from "./chat-rating";

/**
 * ChatRating Select schema
 */
export const selectChatRatingSchema = createSelectSchema(chatRating);

/**
 * ChatRating Insert schema
 */
export const insertChatRatingSchema = createInsertSchema(chatRating, {
  rating: z.number().int().min(1).max(5),
});

/**
 * Types
 */
export type ChatRating = z.infer<typeof selectChatRatingSchema>;
export type NewChatRating = z.infer<typeof insertChatRatingSchema>;
