import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { tenant } from "./tenant";
import { tenantStatus, tenantTier } from "./constants";

/**
 * Enum schemas
 */
export const tenantStatusSchema = z.enum(tenantStatus);
export const tenantTierSchema = z.enum(tenantTier);

/**
 * Select schema
 */
export const selectTenantSchema = createSelectSchema(tenant, {
  status: tenantStatusSchema.default("provisioning"),
  tier: tenantTierSchema.default("shared"),
  region: z.string().max(50).nullable(),
});

/**
 * Insert schema
 */
export const insertTenantSchema = createInsertSchema(tenant, {
  slug: z
    .string()
    .min(3, "Slug deve ter pelo menos 3 caracteres")
    .max(100, "Slug deve ter no máximo 100 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens",
    )
    .toLowerCase(),
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  databaseName: z
    .string()
    .min(3)
    .max(100)
    .regex(
      /^[a-z0-9_]+$/,
      "Nome do database deve conter apenas letras, números e underscores",
    ),
  status: tenantStatusSchema.default("provisioning"),
  tier: tenantTierSchema.default("shared"),
});

/**
 * Update schema
 */
export const updateTenantSchema = insertTenantSchema.partial();

/**
 * Types
 */
export type Tenant = z.infer<typeof selectTenantSchema>;
export type NewTenant = z.infer<typeof insertTenantSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;
export type TenantStatus = z.infer<typeof tenantStatusSchema>;
export type TenantTier = z.infer<typeof tenantTierSchema>;
