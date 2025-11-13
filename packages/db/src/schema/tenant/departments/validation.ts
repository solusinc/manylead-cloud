import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { department } from "./department";

/**
 * Select schema
 */
export const selectDepartmentSchema = createSelectSchema(department);

/**
 * Insert schema
 */
export const insertDepartmentSchema = createInsertSchema(department, {
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
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
