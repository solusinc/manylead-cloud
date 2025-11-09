/**
 * Tenant Database - Relations
 *
 * Centralized relations to avoid circular dependencies
 */

import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { organizationMembers } from "./organization-members";
import { organizationInvitations } from "./organization-invitations";

export const organizationsRelations = relations(organizations, ({ many }) => ({
	members: many(organizationMembers),
	invitations: many(organizationInvitations),
}));

export const organizationMembersRelations = relations(
	organizationMembers,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationMembers.organizationId],
			references: [organizations.id],
		}),
	}),
);

export const organizationInvitationsRelations = relations(
	organizationInvitations,
	({ one }) => ({
		organization: one(organizations, {
			fields: [organizationInvitations.organizationId],
			references: [organizations.id],
		}),
	}),
);
