import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { tag } from "./tag";
import { chatTag } from "./chat-tag";

/**
 * Tag Schemas
 */
export const selectTagSchema = createSelectSchema(tag);

export const insertTagSchema = createInsertSchema(tag, {
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato hex (#RRGGBB)"),
});

export const updateTagSchema = insertTagSchema.partial();

/**
 * ChatTag Schemas
 */
export const selectChatTagSchema = createSelectSchema(chatTag);

export const insertChatTagSchema = createInsertSchema(chatTag, {
  chatId: z.string().uuid("ID do chat inválido"),
  tagId: z.string().uuid("ID da tag inválido"),
});

/**
 * Types
 */
export type Tag = z.infer<typeof selectTagSchema>;
export type NewTag = z.infer<typeof insertTagSchema>;
export type UpdateTag = z.infer<typeof updateTagSchema>;

export type ChatTag = z.infer<typeof selectChatTagSchema>;
export type NewChatTag = z.infer<typeof insertChatTagSchema>;
