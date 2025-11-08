import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { activityLog } from "./activity-log";
import { activityLogCategory, activityLogSeverity } from "./constants";

/**
 * Enum schemas
 */
export const activityLogCategorySchema = z.enum(activityLogCategory);
export const activityLogSeveritySchema = z.enum(activityLogSeverity);

/**
 * Select schema
 */
export const selectActivityLogSchema = createSelectSchema(activityLog, {
  category: activityLogCategorySchema,
  severity: activityLogSeveritySchema.default("info"),
});

/**
 * Insert schema
 */
export const insertActivityLogSchema = createInsertSchema(activityLog, {
  action: z.string().min(1).max(100),
  category: activityLogCategorySchema,
  severity: activityLogSeveritySchema.default("info"),
  description: z.string().min(1),
});

/**
 * Update schema
 */
export const updateActivityLogSchema = insertActivityLogSchema.partial();

/**
 * Types
 */
export type ActivityLog = z.infer<typeof selectActivityLogSchema>;
export type NewActivityLog = z.infer<typeof insertActivityLogSchema>;
export type UpdateActivityLog = z.infer<typeof updateActivityLogSchema>;
export type ActivityLogCategory = z.infer<typeof activityLogCategorySchema>;
export type ActivityLogSeverity = z.infer<typeof activityLogSeveritySchema>;
