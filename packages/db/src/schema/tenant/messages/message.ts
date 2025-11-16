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
import { v7 as uuidv7 } from "uuid";
import { chat } from "../chats/chat";

/**
 * Messages - Mensagens
 *
 * Armazena todas as mensagens (WhatsApp e internas)
 * Particionada por timestamp (mensal) via pg_partman APENAS para mensagens do WhatsApp
 */
export const message = pgTable(
  "message",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    chatId: uuid("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),

    // WhatsApp Message ID
    whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
    // ID único da mensagem no WhatsApp (para evitar duplicatas)

    messageSource: varchar("message_source", { length: 20 }).notNull(),
    // "whatsapp" | "internal"

    // Remetente
    sender: varchar("sender", { length: 20 }).notNull(),
    // "contact" | "agent" | "system"

    senderId: uuid("sender_id"),
    // ID do contact ou agent que enviou

    // Conteúdo
    messageType: varchar("message_type", { length: 20 }).notNull(),
    // "text" | "image" | "video" | "audio" | "document" | "system"

    content: text("content").notNull(),

    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Dados adicionais (contexto, replied message, etc)

    // Status (principalmente para mensagens enviadas)
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    // "pending" | "sent" | "delivered" | "read" | "failed"

    errorCode: varchar("error_code", { length: 50 }),
    errorMessage: text("error_message"),

    // Timestamps
    timestamp: timestamp("timestamp").notNull().defaultNow(),
    // Partitioning key (mensal) - horário real da mensagem

    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),

    // Flags
    isDeleted: boolean("is_deleted").notNull().default(false),
    isEdited: boolean("is_edited").notNull().default(false),

    visibleTo: varchar("visible_to", { length: 20 }).default("all"),
    // "all" | "agents_only" (para notas internas)

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Unique: WhatsApp message ID (apenas para mensagens do WhatsApp)
    unique("message_whatsapp_id_unique").on(table.whatsappMessageId),

    index("message_chat_idx").on(table.chatId),
    index("message_sender_idx").on(table.senderId),
    index("message_status_idx").on(table.status),

    // Composite index para queries comuns (mais recente primeiro)
    index("message_chat_timestamp_idx").on(table.chatId, table.timestamp),
  ]
);
