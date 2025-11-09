import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Organization table (Better Auth plugin)
 *
 * Multi-tenant organizations managed by Better Auth
 */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
});
