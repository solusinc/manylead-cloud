/**
 * Organization Members - Zod Validation Schemas
 */

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organizationMembers } from "./organization-member";
import { organizationRoles } from "./constants";

// Schemas gerados automaticamente do Drizzle
export const selectOrganizationMemberSchema = createSelectSchema(organizationMembers);

export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers, {
	role: z.enum(organizationRoles),
	userId: z.string().min(1, "User ID é obrigatório"),
});

// Export types
export type SelectOrganizationMember = z.infer<typeof selectOrganizationMemberSchema>;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
