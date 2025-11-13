import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { agent } from "../agents/agent";

/**
 * Departments table - Departamentos para organização da equipe
 *
 * Permite criar setores (Vendas, Suporte, Financeiro, etc.) para
 * roteamento de conversas e distribuição de carga de trabalho
 */
export const department = pgTable(
  "department",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    organizationId: text("organization_id").notNull(),
    // Referência ao organization.id do catalog DB (Better Auth)
    // Não pode usar FK pois está em outro database

    // Informações básicas
    name: varchar("name", { length: 100 }).notNull(),
    // Ex: "Vendas", "Suporte", "Financeiro"

    // Configurações
    workingHours: jsonb("working_hours").$type<{
      enabled: boolean;
      timezone: string;
      schedule: Record<
        string,
        { start: string; end: string; enabled: boolean }
      >;
      // Ex: { monday: { start: "09:00", end: "18:00", enabled: true } }
    }>(),

    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("department_org_name_unique").on(table.organizationId, table.name),
    index("department_org_idx").on(table.organizationId),
    index("department_active_idx").on(table.isActive),
  ],
);

/**
 * Relations
 */
export const departmentRelations = relations(department, ({ many }) => ({
  agents: many(agent),
}));
