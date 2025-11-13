import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organizationSettings } from "./organization-settings";

// Base schemas
export const selectOrganizationSettingsSchema = createSelectSchema(organizationSettings);
export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings);

// Update schema (partial)
export const updateOrganizationSettingsSchema = insertOrganizationSettingsSchema
  .omit({
    id: true,
    organizationId: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

// Working hours schedule type
export const dayScheduleSchema = z.object({
  start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:mm)"),
  end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:mm)"),
  enabled: z.boolean(),
});

export const organizationWorkingHoursSchema = z.object({
  enabled: z.boolean(),
  schedule: z.record(z.string(), dayScheduleSchema),
});

// Types
export type OrganizationSettings = z.infer<typeof selectOrganizationSettingsSchema>;
export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;
export type UpdateOrganizationSettings = z.infer<typeof updateOrganizationSettingsSchema>;
export type DaySchedule = z.infer<typeof dayScheduleSchema>;
export type OrganizationWorkingHours = z.infer<typeof organizationWorkingHoursSchema>;
