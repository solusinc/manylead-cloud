import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "./organization";
import { user } from "./user";

/**
 * Invitation table (Better Auth plugin)
 *
 * Organization invitations
 */
export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ({
    // Índice para listar invitations de uma organização
    organizationIdIdx: index("invitation_organization_id_idx").on(
      table.organizationId,
    ),
    // Índice para buscar por email
    emailIdx: index("invitation_email_idx").on(table.email),
    // Índice composto para filtrar invitations pending por organização
    orgStatusIdx: index("invitation_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
  }),
);
