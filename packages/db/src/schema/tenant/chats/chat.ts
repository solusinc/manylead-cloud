import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { agent } from "../agents/agent";
import { channel } from "../channels/channel";
import { contact } from "../contacts/contact";

/**
 * Chats - Conversas/Atendimentos
 *
 * Tabela principal de conversas, suporta:
 * - Chats do WhatsApp (messageSource: "whatsapp")
 * - Chats internos Manylead (messageSource: "internal")
 *
 * Particionada por created_at (mensal) via pg_partman
 */
export const chat = pgTable(
  "chat",
  {
    id: uuid("id")
      .notNull()
      .$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    // Relações
    channelId: uuid("channel_id").references(() => channel.id, {
      onDelete: "set null",
    }),
    // NULL para chats internos

    contactId: uuid("contact_id")
      .notNull()
      .references(() => contact.id, { onDelete: "cascade" }),

    // Tipo de mensagem
    messageSource: varchar("message_source", { length: 20 }).notNull(),
    // "whatsapp" | "internal"

    // Atribuição
    assignedTo: uuid("assigned_to").references(() => agent.id, {
      onDelete: "set null",
    }),
    // Agent responsável pelo atendimento

    departmentId: uuid("department_id"),
    // Referência ao departamento (sem FK para evitar complexidade)

    // Status
    status: varchar("status", { length: 20 }).notNull().default("open"),
    // "open" | "pending" | "closed" | "snoozed"

    // Metadata da última mensagem (para performance)
    lastMessageAt: timestamp("last_message_at"),
    lastMessageContent: text("last_message_content"),
    lastMessageSender: varchar("last_message_sender", { length: 20 }),
    // "contact" | "agent" | "system"

    // Contadores
    unreadCount: integer("unread_count").notNull().default(0),
    totalMessages: integer("total_messages").notNull().default(0),

    // Flags
    priority: varchar("priority", { length: 20 }).default("normal"),
    // "low" | "normal" | "high" | "urgent"

    isArchived: boolean("is_archived").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),

    snoozedUntil: timestamp("snoozed_until"),
    // Quando status=snoozed, data/hora para reativar automaticamente

    // Instance code (para chats internos)
    initiatorInstanceCode: varchar("initiator_instance_code", { length: 50 }),
    // Código do agent que iniciou o chat interno

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // Partitioning key (mensal)
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // PRIMARY KEY composto (id + created_at) - OBRIGATÓRIO para TimescaleDB hypertables
    pk: primaryKey({ columns: [table.id, table.createdAt] }),

    // NOTA: TODOS os indexes e constraints serão criados DEPOIS do hypertable em timescale.ts
    // TimescaleDB NÃO PERMITE indexes existentes antes da conversão para hypertable
  }),
);
