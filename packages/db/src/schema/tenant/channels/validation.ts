import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { channel } from "./channel";

/**
 * Select schema (retorno de queries)
 */
export const selectChannelSchema = createSelectSchema(channel);

/**
 * Insert schema (criação de canal QR Code)
 */
export const insertChannelSchema = createInsertSchema(channel, {
  displayName: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Formato inválido. Use +5511999999999")
    .optional(),
}).omit({
  organizationId: true, // Será preenchido automaticamente
  phoneNumberId: true, // Será gerado automaticamente no create
});

/**
 * Update schema (atualização - todos campos opcionais)
 */
export const updateChannelSchema = insertChannelSchema.partial();

/**
 * Types
 */
export type Channel = z.infer<typeof selectChannelSchema>;
export type NewChannel = z.infer<typeof insertChannelSchema>;
export type UpdateChannel = z.infer<typeof updateChannelSchema>;
