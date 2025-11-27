import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { contact } from "./contact";

/**
 * Select schema
 */
export const selectContactSchema = createSelectSchema(contact);

/**
 * Insert schema
 */
export const insertContactSchema = createInsertSchema(contact, {
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  phoneNumber: z
    .string()
    .regex(/^\+\d{10,15}$/, "Formato inválido. Use +5511988884444")
    .nullable()
    .optional(),
  email: z.string().email("Email inválido").nullable().optional(),
});

/**
 * Update schema
 */
export const updateContactSchema = insertContactSchema.partial();

/**
 * Types
 */
export type Contact = z.infer<typeof selectContactSchema>;
export type NewContact = z.infer<typeof insertContactSchema>;
export type UpdateContact = z.infer<typeof updateContactSchema>;
