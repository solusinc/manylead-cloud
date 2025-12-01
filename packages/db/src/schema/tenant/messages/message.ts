import {
  boolean,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

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
      .notNull()
      .$defaultFn(() => uuidv7()),

    chatId: uuid("chat_id").notNull(),
    // NOTA: FK removido porque TimescaleDB PRIMARY KEYs compostos incompatíveis
    // chat tem PK (id, created_at) e message tem PK (id, timestamp)
    // FK será validado na aplicação

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

    senderName: varchar("sender_name", { length: 255 }),
    // Nome do remetente (agent ou contact) no momento do envio

    // Conteúdo
    messageType: varchar("message_type", { length: 20 }).notNull(),
    // "text" | "image" | "video" | "audio" | "document" | "system"

    content: text("content").notNull(),

    // Resposta a outra mensagem (reply)
    repliedToMessageId: uuid("replied_to_message_id"),
    // ID da mensagem sendo respondida (NULL se não for resposta)

    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    // Dados adicionais (contexto, etc)

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
    editedAt: timestamp("edited_at"),

    // Flags
    isDeleted: boolean("is_deleted").notNull().default(false),
    isEdited: boolean("is_edited").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),

    visibleTo: varchar("visible_to", { length: 20 }).default("all"),
    // "all" | "agents_only" (para notas internas)

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    // PRIMARY KEY composto (id + timestamp) - OBRIGATÓRIO para TimescaleDB hypertables
    pk: primaryKey({ columns: [table.id, table.timestamp] }),

    // NOTA: TODOS os indexes e constraints serão criados DEPOIS do hypertable em timescale.ts
    // TimescaleDB NÃO PERMITE indexes existentes antes da conversão para hypertable
  }),
);
