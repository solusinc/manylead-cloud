import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Agent table - Usuários com permissões granulares
 *
 * Extensão do member do Better Auth com configurações específicas
 * do tenant e permissões detalhadas de acesso
 */
export const agent = pgTable(
  "agent",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    userId: varchar("user_id", { length: 255 }).notNull().unique(),
    // ID do Better Auth user

    role: varchar("role", { length: 50 }).notNull().default("member"),
    // Role do agente: owner | admin | member
    // (espelhado do Better Auth member.role para evitar cross-DB)

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
        messages: {
          canEdit: boolean;
          canDelete: boolean;
        };
        accessFinishedChats: boolean;
        notificationSoundsEnabled: boolean;
      }>()
      .default({
        departments: { type: "all" },
        channels: { type: "all" },
        messages: { canEdit: false, canDelete: false },
        accessFinishedChats: false,
        notificationSoundsEnabled: true,
      })
      .notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_user_idx").on(table.userId),
    index("agent_active_idx").on(table.isActive),
  ],
);
