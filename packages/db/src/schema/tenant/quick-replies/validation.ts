import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { quickReply } from "./quick-reply";
import { QUICK_REPLY_CONTENT_TYPES, QUICK_REPLY_VISIBILITY } from "./constants";

/**
 * Schema para uma mensagem individual dentro de um quick reply
 */
export const quickReplyMessageSchema = z.object({
  type: z.enum(QUICK_REPLY_CONTENT_TYPES),
  content: z.string().min(1, "Conteúdo é obrigatório"),

  // Campos para mídia (image, audio, document)
  mediaUrl: z.string().url("URL inválida").optional().nullable(),
  mediaName: z.string().max(255).optional().nullable(),
  mediaMimeType: z.string().max(100).optional().nullable(),

  // Campos para localização
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  locationName: z.string().max(255).optional().nullable(),
  locationAddress: z.string().max(500).optional().nullable(),
});

/**
 * QuickReply Schemas
 */
export const selectQuickReplySchema = createSelectSchema(quickReply);

export const insertQuickReplySchema = createInsertSchema(quickReply, {
  shortcut: z
    .string()
    .min(2, "Atalho deve ter pelo menos 2 caracteres")
    .max(50, "Atalho deve ter no máximo 50 caracteres")
    .regex(
      /^\/[a-z0-9_-]+$/,
      "Atalho deve começar com / e conter apenas letras minúsculas, números, _ ou -",
    ),
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .max(200, "Título deve ter no máximo 200 caracteres"),
  messages: z.array(quickReplyMessageSchema).min(1, "Adicione pelo menos uma mensagem"),
  content: z.string().optional(), // Gerado automaticamente
  visibility: z.enum(QUICK_REPLY_VISIBILITY).default("organization"),
});

export const updateQuickReplySchema = insertQuickReplySchema.partial();

/**
 * Schema para busca/filtro de quick replies
 */
export const searchQuickReplySchema = z.object({
  search: z.string().optional(),
  visibility: z.enum(QUICK_REPLY_VISIBILITY).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Types
 */
export type QuickReply = z.infer<typeof selectQuickReplySchema>;
export type NewQuickReply = z.infer<typeof insertQuickReplySchema>;
export type UpdateQuickReply = z.infer<typeof updateQuickReplySchema>;
export type SearchQuickReply = z.infer<typeof searchQuickReplySchema>;
export type QuickReplyMessageInput = z.infer<typeof quickReplyMessageSchema>;
