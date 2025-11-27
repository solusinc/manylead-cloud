import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Endings - Motivos de Finalização
 *
 * Permite categorizar e organizar sessões finalizadas de forma eficiente.
 */
export const ending = pgTable(
  "ending",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    title: varchar("title", { length: 100 }).notNull(),

    endingMessage: text("ending_message"),

    // "default" | "enabled" | "disabled"
    ratingBehavior: varchar("rating_behavior", { length: 20 }).notNull().default("default"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("ending_org_title_unique").on(table.organizationId, table.title),
    index("ending_org_idx").on(table.organizationId),
  ],
);
