/**
 * Organization Members Schema
 */

import {
	boolean,
	index,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "../organizations";

export const organizationMembers = pgTable(
	"organization_members",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		organizationId: uuid("organization_id")
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		userId: varchar("user_id", { length: 255 }).notNull(), // Better Auth ID

		role: varchar("role", { length: 50 }).notNull().default("member"),
		// Valores possíveis: 'owner', 'admin', 'member'

		isActive: boolean("is_active").default(true).notNull(),

		// Timestamps
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => ({
		uniqueUserOrg: unique("organization_members_user_org_unique").on(
			table.organizationId,
			table.userId,
		),
		orgIdx: index("organization_members_org_idx").on(table.organizationId),
		userIdx: index("organization_members_user_idx").on(table.userId),
	}),
);

