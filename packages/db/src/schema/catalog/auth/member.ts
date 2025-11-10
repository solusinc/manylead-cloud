import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./organization";
import { user } from "./user";

/**
 * Member table (Better Auth plugin)
 *
 * Organization membership with roles
 */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    // Índice para listar organizações de um usuário (query mais comum)
    userIdIdx: index("member_user_id_idx").on(table.userId),
    // Índice para listar membros de uma organização
    organizationIdIdx: index("member_organization_id_idx").on(
      table.organizationId,
    ),
    // Índice composto para verificar membership específico
    userOrgIdx: index("member_user_org_idx").on(
      table.userId,
      table.organizationId,
    ),
  }),
);
