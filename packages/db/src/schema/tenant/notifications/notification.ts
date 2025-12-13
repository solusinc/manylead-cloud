import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import type { NotificationMetadata } from "./constants";

/**
 * Notification table - Sistema de notificações por organização
 *
 * Controle de visibilidade:
 * - targetUserId: Se preenchido, só esse usuário específico vê
 * - visibleToRoles: Array de roles ['owner', 'admin']. Se null, todos veem
 *
 * Exemplos:
 * - Cobrança: targetUserId=null, visibleToRoles=['owner']
 * - Você foi promovido: targetUserId='user123', visibleToRoles=null
 * - Novo chat: targetUserId=null, visibleToRoles=null (todos)
 */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // Referência à organização (denormalizado para facilitar queries)
    organizationId: text("organization_id").notNull(),

    // Controle de visibilidade
    targetUserId: varchar("target_user_id", { length: 255 }),
    // Se preenchido, só esse usuário vê (tem prioridade)

    visibleToRoles: jsonb("visible_to_roles").$type<
      ("owner" | "admin" | "member")[] | null
    >(),
    // Se null, todos veem. Se preenchido, só quem tem role na lista vê

    // Tipo de notificação
    type: varchar("type", { length: 50 }).notNull(),
    // 'billing' | 'plan_expiring' | 'member_promoted' | 'chat_assigned' | 'system'

    // Título e mensagem
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),

    // Ação ao clicar (link relativo)
    actionUrl: text("action_url"),

    // Dados adicionais
    metadata: jsonb("metadata").$type<NotificationMetadata>(),

    // Status
    read: boolean("read").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => [
    index("notification_organization_id_idx").on(table.organizationId),
    index("notification_target_user_idx").on(table.targetUserId),
    index("notification_unread_idx").on(table.read, table.createdAt),
    index("notification_created_at_idx").on(table.createdAt),
  ],
);

// Tipos básicos
export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;
