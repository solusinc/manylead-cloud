import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { tenant } from "../tenants";
import { migrationStatus } from "./constants";

/**
 * Migration Log table - Log de migrations executadas em cada tenant
 */
export const migrationLog = pgTable(
  "migration_log",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),

    migrationName: varchar("migration_name", { length: 255 }).notNull(),
    // Ex: 0001_create_organizations.sql

    status: varchar("status", { length: 50, enum: migrationStatus }).notNull(),

    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    error: text("error"),
    // Mensagem de erro se migration falhou

    executionTimeMs: integer("execution_time_ms"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("migration_log_tenant_id_idx").on(table.tenantId),
    index("migration_log_status_idx").on(table.status),
  ],
);

export const migrationLogRelations = relations(migrationLog, ({ one }) => ({
  tenant: one(tenant, {
    fields: [migrationLog.tenantId],
    references: [tenant.id],
  }),
}));
