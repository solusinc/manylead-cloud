import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { department } from "./department";

/**
 * Working hours schemas
 */
const dayScheduleSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:MM)"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:MM)"),
  enabled: z.boolean(),
});

export const workingHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().min(1, "Timezone é obrigatório"),
  schedule: z.record(z.string(), dayScheduleSchema),
}).optional();

/**
 * Select schema
 */
export const selectDepartmentSchema = createSelectSchema(department, {
  workingHours: workingHoursSchema
    .nullish()
    .transform((v) => (v === null ? undefined : v)),
});

/**
 * Insert schema
 */
export const insertDepartmentSchema = createInsertSchema(department, {
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  workingHours: workingHoursSchema,
});

/**
 * Update schema
 */
export const updateDepartmentSchema = insertDepartmentSchema.partial();

/**
 * Types
 */
export type Department = z.infer<typeof selectDepartmentSchema>;
export type NewDepartment = z.infer<typeof insertDepartmentSchema>;
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;
