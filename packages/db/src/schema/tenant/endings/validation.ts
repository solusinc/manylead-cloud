import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { ending } from "./ending";

/**
 * Ending Schemas
 */
export const selectEndingSchema = createSelectSchema(ending);

export const insertEndingSchema = createInsertSchema(ending, {
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .max(100, "Título deve ter no máximo 100 caracteres"),
  endingMessage: z.string().max(1000, "Mensagem deve ter no máximo 1000 caracteres").optional(),
  ratingBehavior: z.enum(["default", "enabled", "disabled"]),
});

export const updateEndingSchema = insertEndingSchema.partial();

/**
 * Types
 */
export type Ending = z.infer<typeof selectEndingSchema>;
export type NewEnding = z.infer<typeof insertEndingSchema>;
export type UpdateEnding = z.infer<typeof updateEndingSchema>;
