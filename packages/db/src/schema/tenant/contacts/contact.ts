import {
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

/**
 * Contacts - Contatos do WhatsApp e Internos
 *
 * Armazena informações de contatos que interagiram via WhatsApp,
 * foram criados manualmente no sistema, ou representam agentes
 * internos para comunicação ManyLead-to-ManyLead
 */
export const contact = pgTable(
  "contact",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    // Identificação
    phoneNumber: varchar("phone_number", { length: 20 }),
    // Formato: 5511999999999 (sem símbolos)
    // NULL para contatos internos (agentes ManyLead)

    name: varchar("name", { length: 255 }).notNull(),

    avatar: text("avatar"),
    // URL da foto de perfil

    email: varchar("email", { length: 255 }),

    // Nome personalizado (sobrescreve o nome padrão na UI)
    customName: varchar("custom_name", { length: 255 }),

    // Observações sobre o contato
    notes: text("notes"),

    // Campos customizados (key-value strings, ex: "Campo-1": "valor")
    customFields: jsonb("custom_fields").$type<Record<string, string>>(),

    // Metadata
    metadata: jsonb("metadata").$type<{
      source: "whatsapp" | "manual" | "internal";
      firstMessageAt?: Date;
      lastMessageAt?: Date;
      whatsappProfileName?: string; // pushName do WhatsApp
      agentId?: string; // ID do agent (para source: "internal" intra-org)
      targetOrganizationId?: string; // ID da org alvo (para cross-org)
      targetOrganizationName?: string; // Nome da org alvo (para cross-org)
      targetOrganizationInstanceCode?: string; // instanceCode da org alvo
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Unique: um contato por número por organização
    unique("contact_org_phone_unique").on(
      table.organizationId,
      table.phoneNumber,
    ),

    index("contact_org_idx").on(table.organizationId),
    index("contact_phone_idx").on(table.phoneNumber),
    index("contact_name_idx").on(table.name),

    // Index para buscar contatos recentes da org
    index("contact_org_created_idx").on(
      table.organizationId,
      table.createdAt.desc(),
    ),
  ],
);
