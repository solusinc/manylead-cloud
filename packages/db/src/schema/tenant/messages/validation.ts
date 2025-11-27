import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { message } from "./message";

/**
 * Select schema
 */
export const selectMessageSchema = createSelectSchema(message);

/**
 * Insert schema
 */
export const insertMessageSchema = createInsertSchema(message, {
  content: z.string().min(1, "Conteúdo é obrigatório"),
  messageType: z.enum(["text", "image", "video", "audio", "document", "system", "comment"]),
  messageSource: z.enum(["whatsapp", "internal"]),
  sender: z.enum(["contact", "agent", "system"]),
  status: z.enum(["pending", "sent", "delivered", "read", "failed"]).default("pending"),
  visibleTo: z.enum(["all", "agents_only"]).default("all"),
});

/**
 * Update schema
 */
export const updateMessageSchema = insertMessageSchema.partial();

/**
 * Types
 */
export type Message = z.infer<typeof selectMessageSchema>;
export type NewMessage = z.infer<typeof insertMessageSchema>;
export type UpdateMessage = z.infer<typeof updateMessageSchema>;
