import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  integer,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { tenant } from "../tenants";

/**
 * Tenant Metrics table - Métricas agregadas de cada tenant
 *
 * Atualizado periodicamente via pg_cron ou worker
 */
export const tenantMetric = pgTable(
  "tenant_metric",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),

    // Métricas de uso
    messageCount: bigint("message_count", { mode: "number" })
      .notNull()
      .default(0),
    conversationCount: integer("conversation_count").notNull().default(0),
    contactCount: integer("contact_count").notNull().default(0),
    userCount: integer("user_count").notNull().default(0),
    channelCount: integer("channel_count").notNull().default(0),

    // Storage
    databaseSizeMb: integer("database_size_mb").notNull().default(0),
    attachmentCount: integer("attachment_count").notNull().default(0),
    attachmentSizeMb: integer("attachment_size_mb").notNull().default(0),

    // Performance
    avgQueryTimeMs: integer("avg_query_time_ms"),
    connectionCount: integer("connection_count"),

    // Período da métrica
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_metric_tenant_id_idx").on(table.tenantId),
    index("tenant_metric_period_idx").on(table.periodStart, table.periodEnd),
  ],
);

export const tenantMetricRelations = relations(tenantMetric, ({ one }) => ({
  tenant: one(tenant, {
    fields: [tenantMetric.tenantId],
    references: [tenant.id],
  }),
}));
