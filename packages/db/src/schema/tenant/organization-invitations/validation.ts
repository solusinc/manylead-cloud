/**
 * Organization Invitations - Zod Validation Schemas
 */

import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { organizationInvitations } from "./organization-invitation";
import { invitationStatuses } from "./constants";
import { organizationRoles } from "../organization-members";

// Schemas gerados automaticamente do Drizzle
export const selectOrganizationInvitationSchema = createSelectSchema(organizationInvitations);

export const insertOrganizationInvitationSchema = createInsertSchema(organizationInvitations, {
	email: z.string().email("Email inválido"),
	role: z.enum(organizationRoles),
	status: z.enum(invitationStatuses),
	token: z.string().min(1, "Token é obrigatório"),
});

// Export types
export type SelectOrganizationInvitation = z.infer<typeof selectOrganizationInvitationSchema>;
export type InsertOrganizationInvitation = z.infer<typeof insertOrganizationInvitationSchema>;
