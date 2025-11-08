import { relations } from "drizzle-orm";
import { pgTable, boolean, text, timestamp } from "drizzle-orm/pg-core";

import { session } from "./session";
import { account } from "./account";

/**
 * User table - Better Auth schema
 *
 * IMPORTANTE: Better Auth usa `text` para IDs (não uuid)
 * Isso permite flexibilidade para diferentes formatos de ID (nanoid, cuid, etc)
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));
