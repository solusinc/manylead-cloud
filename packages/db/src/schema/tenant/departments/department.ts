import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

    description: text("description"),

    // Configurações
    autoAssignment: boolean("auto_assignment").default(false).notNull(),
    // Se true, conversas são distribuídas automaticamente entre membros

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
