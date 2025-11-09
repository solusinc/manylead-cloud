/**
 * Organization Invitations Schema
 */

import {
	index,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";

export const organizationInvitations = pgTable(
	"organization_invitations",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		email: varchar("email", { length: 255 }).notNull(),
		role: varchar("role", { length: 50 }).notNull().default("member"),

		token: varchar("token", { length: 255 }).notNull().unique(),

		status: varchar("status", { length: 50 }).notNull().default("pending"),
		// Status: pending, accepted, expired, canceled

		invitedBy: varchar("invited_by", { length: 255 }).notNull(), // userId

		expiresAt: timestamp("expires_at").notNull(),
		acceptedAt: timestamp("accepted_at"),

		// Timestamps
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		uniquePendingInvite: unique("organization_invitations_pending_unique").on(
			table.organizationId,
			table.email,
			table.status,
		),
		orgIdx: index("organization_invitations_org_idx").on(table.organizationId),
		emailIdx: index("organization_invitations_email_idx").on(table.email),
		tokenIdx: index("organization_invitations_token_idx").on(table.token),
		statusIdx: index("organization_invitations_status_idx").on(table.status),
	}),
);

