import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { chatTag } from "./chat-tag";

/**
 * Tags table - Etiquetas para organização de chats
 *
 * Permite criar etiquetas coloridas para categorizar e filtrar
 * conversas no inbox (ex: "Aguardando retorno", "Interno", "Novo")
 */
export const tag = pgTable(
  "tag",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),
    // Referência ao organization.id do catalog DB (Better Auth)
    // Não pode usar FK pois está em outro database

    // Informações básicas
    name: varchar("name", { length: 100 }).notNull(),
    // Ex: "Aguardando retorno", "Interno", "Novo", "VIP"

    color: varchar("color", { length: 7 }).notNull().default("#3b82f6"),
    // Cor em formato hex (ex: "#00ff00", "#ff0000")
    // Default: blue-500

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tag_org_name_unique").on(table.organizationId, table.name),
    index("tag_org_idx").on(table.organizationId),
  ],
);

/**
 * Relations
 */
export const tagRelations = relations(tag, ({ many }) => ({
  chatTags: many(chatTag),
}));
