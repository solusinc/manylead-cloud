import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { channel } from "./channel";
import { CHANNEL_TYPE } from "./constants";

/**
 * Select schema (retorno de queries)
 */
export const selectChannelSchema = createSelectSchema(channel);

/**
 * Insert schema (criação de canal)
 */
export const insertChannelSchema = createInsertSchema(channel, {
  channelType: z.enum([CHANNEL_TYPE.QR_CODE, CHANNEL_TYPE.OFFICIAL]),
  displayName: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Formato inválido. Use +5511999999999")
    .optional(),
}).omit({
  id: true,
  organizationId: true, // Será preenchido automaticamente
  phoneNumberId: true, // Será gerado automaticamente no create
  evolutionInstanceName: true, // Será gerado automaticamente no create
  evolutionConnectionState: true,
  status: true,
  isActive: true,
  lastConnectedAt: true,
  lastMessageAt: true,
  messageCount: true,
  connectionAttempts: true,
  verifiedAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
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
