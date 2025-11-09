import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

import { department } from "../departments/department";

/**
 * Agent table - Atendentes com permissões granulares
 *
 * Extensão do member do Better Auth com configurações específicas
 * do tenant e permissões detalhadas de acesso
 */
export const agent = pgTable(
  "agent",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: varchar("user_id", { length: 255 }).notNull().unique(),
    // ID do Better Auth user

    departmentId: uuid("department_id").references(() => department.id, {
      onDelete: "set null",
    }),
    // NULL = acesso a todos os departamentos

    // Permissões granulares
    permissions: jsonb("permissions")
      .$type<{
        departments: {
          type: "all" | "specific";
          ids?: string[];
        };
        channels: {
          type: "all" | "specific";
          ids?: string[];
        };
      }>()
      .default({
        departments: { type: "all" },
        channels: { type: "all" },
      })
      .notNull(),

    // Configurações de atendimento
    maxActiveConversations: integer("max_active_conversations")
      .notNull()
      .default(10),
    currentActiveConversations: integer("current_active_conversations")
      .notNull()
      .default(0),

    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_user_idx").on(table.userId),
    index("agent_dept_idx").on(table.departmentId),
    index("agent_active_idx").on(table.isActive),
  ],
);

export const agentRelations = relations(agent, ({ one }) => ({
  department: one(department, {
    fields: [agent.departmentId],
    references: [department.id],
  }),
}));
