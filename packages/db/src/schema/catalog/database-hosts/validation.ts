import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { databaseHost } from "./database-host";
import { databaseHostStatus, databaseHostTier } from "./constants";

/**
 * Enum schemas
 */
export const databaseHostStatusSchema = z.enum(databaseHostStatus);
export const databaseHostTierSchema = z.enum(databaseHostTier);

/**
 * Select schema
 */
export const selectDatabaseHostSchema = createSelectSchema(databaseHost, {
  status: databaseHostStatusSchema.default("active"),
  tier: databaseHostTierSchema.default("shared"),
  region: z.string().min(1).max(50),
});

/**
 * Insert schema
 */
export const insertDatabaseHostSchema = createInsertSchema(databaseHost, {
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Nome deve conter apenas letras minúsculas, números e hífens",
    ),
  host: z.string().min(1, "Host é obrigatório").max(255),
  port: z.number().int().min(1).max(65535).default(5432),
  region: z.string().min(1, "Região é obrigatória").max(50),
  tier: databaseHostTierSchema.default("shared"),
  maxTenants: z.number().int().min(1).default(70),
  diskCapacityGb: z.number().int().min(1),
  status: databaseHostStatusSchema.default("active"),
});

/**
 * Update schema
 */
export const updateDatabaseHostSchema = insertDatabaseHostSchema.partial();

/**
 * Types
 */
export type DatabaseHost = z.infer<typeof selectDatabaseHostSchema>;
export type NewDatabaseHost = z.infer<typeof insertDatabaseHostSchema>;
export type UpdateDatabaseHost = z.infer<typeof updateDatabaseHostSchema>;
export type DatabaseHostStatus = z.infer<typeof databaseHostStatusSchema>;
export type DatabaseHostTier = z.infer<typeof databaseHostTierSchema>;
