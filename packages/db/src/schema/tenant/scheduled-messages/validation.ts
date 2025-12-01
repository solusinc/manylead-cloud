import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { scheduledMessage } from "./scheduled-message";
import {
  SCHEDULED_CONTENT_TYPES,
  SCHEDULED_STATUS,
  CANCELLATION_REASONS,
} from "./constants";

/**
 * Scheduled Message Schemas
 */
export const selectScheduledMessageSchema = createSelectSchema(scheduledMessage);

export const insertScheduledMessageSchema = createInsertSchema(scheduledMessage, {
  content: z
    .string()
    .min(1, "Conteúdo é obrigatório")
    .max(4000, "Conteúdo deve ter no máximo 4000 caracteres"),
  contentType: z.enum(SCHEDULED_CONTENT_TYPES).default("message"),
  scheduledAt: z.coerce.date().refine(
    (date) => date > new Date(),
    "Data deve ser no futuro"
  ),
  timezone: z.string().min(1, "Timezone é obrigatório"),
  cancelOnContactMessage: z.boolean().default(false),
  cancelOnAgentMessage: z.boolean().default(false),
  cancelOnChatClose: z.boolean().default(false),
});

export const updateScheduledMessageSchema = insertScheduledMessageSchema
  .partial()
  .omit({
    id: true,
    organizationId: true,
    chatId: true,
    chatCreatedAt: true,
    contactId: true,
    createdByAgentId: true,
    status: true,
    metadata: true,
    jobId: true,
    sentAt: true,
    sentMessageId: true,
    errorMessage: true,
    retryCount: true,
    cancelledAt: true,
    cancelledByAgentId: true,
    cancellationReason: true,
    createdAt: true,
    updatedAt: true,
  });

/**
 * Schema para busca/filtro de scheduled messages
 */
export const searchScheduledMessageSchema = z.object({
  chatId: z.string().uuid().optional(),
  chatCreatedAt: z.coerce.date().optional(),
  contactId: z.string().uuid().optional(),
  status: z.enum(SCHEDULED_STATUS).optional(),
  contentType: z.enum(SCHEDULED_CONTENT_TYPES).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
});

/**
 * Schema para cancelamento
 */
export const cancelScheduledMessageSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(CANCELLATION_REASONS).default("manual"),
});

/**
 * Types
 */
export type ScheduledMessage = z.infer<typeof selectScheduledMessageSchema>;
export type NewScheduledMessage = z.infer<typeof insertScheduledMessageSchema>;
export type UpdateScheduledMessage = z.infer<typeof updateScheduledMessageSchema>;
export type SearchScheduledMessage = z.infer<typeof searchScheduledMessageSchema>;
export type CancelScheduledMessage = z.infer<typeof cancelScheduledMessageSchema>;
