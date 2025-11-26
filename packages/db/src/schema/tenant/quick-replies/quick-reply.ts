import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import type { QuickReplyMessage } from "./constants";

/**
 * Quick Replies table - Respostas rápidas para agilizar o atendimento
 *
 * Permite criar atalhos (/comando) que inserem mensagens pré-definidas
 * no chat. Suporta variáveis dinâmicas como {{contact.name}}.
 *
 * Suporta sequência de múltiplas mensagens de diferentes tipos.
 */
export const quickReply = pgTable(
  "quick_reply",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),
    // Referência ao organization.id do catalog DB (Better Auth)
    // Não pode usar FK pois está em outro database

    // Informações básicas
    shortcut: varchar("shortcut", { length: 50 }).notNull(),
    // Ex: "/bem_vindo", "/preco", "/horario"
    // Deve começar com "/" e conter apenas letras, números, _ e -

    title: varchar("title", { length: 200 }).notNull(),
    // Nome descritivo para identificar (ex: "Mensagem de boas vindas")

    // Sequência de mensagens (JSONB array)
    messages: jsonb("messages").$type<QuickReplyMessage[]>().notNull().default([]),
    // Array de mensagens ordenadas para enviar em sequência
    // Cada mensagem tem: type, content, mediaUrl?, mediaName?, mediaMimeType?

    // Campo legado/preview - primeira mensagem de texto para exibição rápida
    content: text("content").notNull().default(""),
    // Usado para preview na lista e busca
    // Atualizado automaticamente com a primeira mensagem de texto

    // Compartilhamento
    visibility: varchar("visibility", { length: 20 }).notNull().default("organization"),
    // "organization" = Para todos na organização
    // "private" = Apenas para o criador

    createdBy: text("created_by").notNull(),
    // userId do criador (para filtrar quando visibility = "private")

    // Analytics
    usageCount: integer("usage_count").notNull().default(0),
    // Contador de quantas vezes foi usado

    lastUsedAt: timestamp("last_used_at"),
    // Última vez que foi usado

    // Status
    isActive: boolean("is_active").notNull().default(true),
    // Se está ativo e disponível para uso

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Shortcut único por organização
    unique("quick_reply_org_shortcut_unique").on(table.organizationId, table.shortcut),

    // Índices para queries frequentes
    index("quick_reply_org_idx").on(table.organizationId),
    index("quick_reply_created_by_idx").on(table.createdBy),
    index("quick_reply_visibility_idx").on(table.visibility),
    index("quick_reply_usage_idx").on(table.usageCount),
  ],
);
