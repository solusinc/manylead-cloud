import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { attachment } from "./attachment";

// Base schemas
export const selectAttachmentSchema = createSelectSchema(attachment);
export const insertAttachmentSchema = createInsertSchema(attachment);

// Update schema (partial)
export const updateAttachmentSchema = insertAttachmentSchema
  .omit({
    id: true,
    messageId: true,
    createdAt: true,
  })
  .partial();

// Types
export type Attachment = z.infer<typeof selectAttachmentSchema>;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type UpdateAttachment = z.infer<typeof updateAttachmentSchema>;
