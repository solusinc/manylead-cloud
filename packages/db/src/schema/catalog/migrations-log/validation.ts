import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { migrationLog } from "./migration-log";
import { migrationStatus } from "./constants";

/**
 * Enum schema
 */
export const migrationStatusSchema = z.enum(migrationStatus);

/**
 * Select schema
 */
export const selectMigrationLogSchema = createSelectSchema(migrationLog, {
  status: migrationStatusSchema,
});

/**
 * Insert schema
 */
export const insertMigrationLogSchema = createInsertSchema(migrationLog, {
  migrationName: z.string().min(1).max(255),
  status: migrationStatusSchema,
});

/**
 * Update schema
 */
export const updateMigrationLogSchema = insertMigrationLogSchema.partial();

/**
 * Types
 */
export type MigrationLog = z.infer<typeof selectMigrationLogSchema>;
export type NewMigrationLog = z.infer<typeof insertMigrationLogSchema>;
export type UpdateMigrationLog = z.infer<typeof updateMigrationLogSchema>;
export type MigrationStatus = z.infer<typeof migrationStatusSchema>;
