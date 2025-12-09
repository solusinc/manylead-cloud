import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Chat Ratings - Avaliações de Atendimento
 *
 * Armazena as avaliações (1-5) dadas pelos clientes após finalização do chat.
 * Usado para relatórios de qualidade de atendimento.
 */
export const chatRating = pgTable(
  "chat_rating",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    // Referência ao chat (composite key)
    chatId: uuid("chat_id").notNull(),
    chatCreatedAt: timestamp("chat_created_at").notNull(),

    // Referência ao contato que avaliou
    contactId: uuid("contact_id").notNull(),

    // Avaliação (1-5)
    rating: integer("rating").notNull(),

    // Quando foi avaliado
    ratedAt: timestamp("rated_at").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_rating_chat_idx").on(table.chatId, table.chatCreatedAt),
    index("chat_rating_contact_idx").on(table.contactId),
    index("chat_rating_rated_at_idx").on(table.ratedAt),
  ],
);
