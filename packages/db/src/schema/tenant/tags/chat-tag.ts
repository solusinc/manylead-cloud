import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { chat } from "../chats/chat";
import { tag } from "./tag";

/**
 * Chat Tags - Relação muitos-para-muitos entre chats e tags
 *
 * Permite associar múltiplas tags a um chat
 *
 * NOTA: Chat usa composite PK (id, createdAt) por ser TimescaleDB particionado,
 * então precisamos referenciar ambos os campos
 */
export const chatTag = pgTable(
  "chat_tag",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    chatId: uuid("chat_id").notNull(),
    // Referência ao chat.id (sem FK por causa do hypertable)

    chatCreatedAt: timestamp("chat_created_at").notNull(),
    // Parte do composite PK do chat (necessário para hypertable)

    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("chat_tag_unique").on(table.chatId, table.chatCreatedAt, table.tagId),
    index("chat_tag_chat_idx").on(table.chatId, table.chatCreatedAt),
    index("chat_tag_tag_idx").on(table.tagId),
  ],
);

/**
 * Relations
 */
export const chatTagRelations = relations(chatTag, ({ one }) => ({
  chat: one(chat, {
    fields: [chatTag.chatId, chatTag.chatCreatedAt],
    references: [chat.id, chat.createdAt],
  }),
  tag: one(tag, {
    fields: [chatTag.tagId],
    references: [tag.id],
  }),
}));
