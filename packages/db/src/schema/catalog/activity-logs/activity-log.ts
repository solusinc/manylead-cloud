import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { tenant } from "../tenants";
import { activityLogCategory, activityLogSeverity } from "./constants";

/**
 * Activity Log table - Auditoria de ações no sistema
 *
 * CRÍTICO: Este schema rastreia desde a FASE 1:
 * - Criação/atualização/exclusão de tenants
 * - Provisioning de databases
 * - Execução de migrations
 * - Ações administrativas
 * - Erros críticos do sistema
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    // Contexto
    tenantId: uuid("tenant_id").references(() => tenant.id, {
      onDelete: "cascade",
    }),
    // Pode ser null para ações globais (ex: criação de tenant)

    // Ação
    action: varchar("action", { length: 100 }).notNull(),
    // Ex: tenant.created, migration.executed, system.error

    category: varchar("category", {
      length: 50,
      enum: activityLogCategory,
    }).notNull(),

    severity: varchar("severity", {
      length: 20,
      enum: activityLogSeverity,
    })
      .notNull()
      .default("info"),

    // Descrição
    description: text("description").notNull(),

    // Metadata
    metadata: jsonb("metadata").$type<{
      userId?: string;
      ip?: string;
      userAgent?: string;
      duration?: number;
      errorMessage?: string;
      stackTrace?: string;
      beforeState?: Record<string, unknown>;
      afterState?: Record<string, unknown>;
      [key: string]: unknown;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activity_log_tenant_id_idx").on(table.tenantId),
    index("activity_log_action_idx").on(table.action),
    index("activity_log_category_idx").on(table.category),
    index("activity_log_severity_idx").on(table.severity),
    index("activity_log_created_at_idx").on(table.createdAt),
  ],
);

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  tenant: one(tenant, {
    fields: [activityLog.tenantId],
    references: [tenant.id],
  }),
}));
