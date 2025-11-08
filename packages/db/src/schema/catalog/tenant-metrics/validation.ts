import type { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { tenantMetric } from "./tenant-metric";

/**
 * Select schema
 */
export const selectTenantMetricSchema = createSelectSchema(tenantMetric);

/**
 * Insert schema
 */
export const insertTenantMetricSchema = createInsertSchema(tenantMetric);

/**
 * Update schema
 */
export const updateTenantMetricSchema = insertTenantMetricSchema.partial();

/**
 * Types
 */
export type TenantMetric = z.infer<typeof selectTenantMetricSchema>;
export type NewTenantMetric = z.infer<typeof insertTenantMetricSchema>;
export type UpdateTenantMetric = z.infer<typeof updateTenantMetricSchema>;
