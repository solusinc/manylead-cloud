import {
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { agent } from "../agents/agent";

/**
 * Chat Participants - Participantes de chats com unreadCount individual
 *
 * Para chats internos: 2 registros (initiator + target)
 * Para chats WhatsApp: 1 registro por agent que visualizou/foi atribuído
 *
 * Permite rastrear unreadCount e lastReadAt por participante
 */
export const chatParticipant = pgTable(
  "chat_participant",
  {
    chatId: uuid("chat_id").notNull(),
    // Referência ao chat (sem FK direto devido ao composite PK do chat)

    chatCreatedAt: timestamp("chat_created_at").notNull(),
    // Parte do composite PK do chat (necessário para lookup)

    agentId: uuid("agent_id")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    // Agent participante

    // Contador de mensagens não lidas PARA ESTE PARTICIPANTE
    unreadCount: integer("unread_count").notNull().default(0),

    // Última vez que o participante leu o chat
    lastReadAt: timestamp("last_read_at"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // PRIMARY KEY composto (chat_id + chat_created_at + agent_id)
    pk: primaryKey({
      columns: [table.chatId, table.chatCreatedAt, table.agentId],
    }),

    // NOTA: Indexes serão criados via migration SQL separada
  }),
);
