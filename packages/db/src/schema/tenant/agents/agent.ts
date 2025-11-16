import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { customAlphabet } from "nanoid";
import { v7 as uuidv7 } from "uuid";

const nanoid = customAlphabet("0123456789abcdef", 10);

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
      }>()
      .default({
        departments: { type: "all" },
        channels: { type: "all" },
      })
      .notNull(),

    isActive: boolean("is_active").default(true).notNull(),

    // Instance Code (para comunicação interna manylead-to-manylead)
    instanceCode: varchar("instance_code", { length: 50 })
      .notNull()
      .unique()
      .$defaultFn(() => `manylead-${nanoid()}`),
    // Formato: manylead-477a286676 (sem hífen no ID, só lowercase hex)

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agent_user_idx").on(table.userId),
    index("agent_active_idx").on(table.isActive),
    index("agent_instance_code_idx").on(table.instanceCode),
  ],
);
