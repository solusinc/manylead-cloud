/**
 * Organizations - Zod Validation Schemas
 */

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organizations } from "./organization";

// Schemas gerados automaticamente do Drizzle
export const selectOrganizationSchema = createSelectSchema(organizations);

export const insertOrganizationSchema = createInsertSchema(organizations, {
	name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(255),
	slug: z
		.string()
		.min(3, "Slug deve ter pelo menos 3 caracteres")
		.max(100)
		.regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
	description: z.string().max(1000).optional(),
});

// Export types
export type SelectOrganization = z.infer<typeof selectOrganizationSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
