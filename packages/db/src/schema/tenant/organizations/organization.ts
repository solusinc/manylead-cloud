/**
 * Organizations Schema
 */

import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizationDefaultSettings } from "./constants";

export const organizations = pgTable(
	"organizations",
	{
		id: uuid("id").primaryKey().defaultRandom(),

		// Identificação
		name: varchar("name", { length: 255 }).notNull(),
		slug: varchar("slug", { length: 100 }).notNull().unique(),
		description: text("description"),

		// Mídias (URLs do storage)
		logo: text("logo"),

		// Configurações
		settings: jsonb("settings")
			.$type<{
				language: string;
				dateFormat: string;
			}>()
			.default(organizationDefaultSettings)
			.notNull(),

		// Status
		isActive: boolean("is_active").default(true).notNull(),

		// Timestamps
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"), // Soft delete
	},
	(table) => ({
		slugIdx: index("organizations_slug_idx").on(table.slug),
		activeIdx: index("organizations_active_idx").on(table.isActive),
	}),
);

// Relations will be defined after all schemas are created
// to avoid circular dependency issues
