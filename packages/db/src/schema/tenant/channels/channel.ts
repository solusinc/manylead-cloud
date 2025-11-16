import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Channels - Canais WhatsApp via Evolution API
 *
 * Estrutura simplificada:
 * - Máximo 2 canais por organização (1 QR Code + 1 Oficial)
 * - Sem relação direta com departments
 */
export const channel = pgTable(
  "channel",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    // Tipo do canal: "qr_code" (não oficial) | "official" (WhatsApp Business API)
    channelType: varchar("channel_type", { length: 20 }).notNull(),

    // Identificação
    phoneNumberId: varchar("phone_number_id", { length: 100 })
      .notNull()
      .unique(),

    phoneNumber: varchar("phone_number", { length: 20 }),

    displayName: varchar("display_name", { length: 255 }),

    profilePictureUrl: text("profile_picture_url"),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    // pending | connected | disconnected | error

    // Message sync status
    syncStatus: varchar("sync_status", { length: 50 })
      .notNull()
      .default("pending"),
    // pending | syncing | completed | failed

    syncCompletedAt: timestamp("sync_completed_at"),

    // Evolution API
    evolutionInstanceName: varchar("evolution_instance_name", { length: 100 })
      .notNull()
      .unique(),

    evolutionConnectionState: varchar("evolution_connection_state", {
      length: 50,
    }),
    // open | close | connecting

    // Flags e metadata
    isActive: boolean("is_active").default(true).notNull(),

    lastConnectedAt: timestamp("last_connected_at"),

    lastMessageAt: timestamp("last_message_at"),

    messageCount: integer("message_count").default(0).notNull(),

    connectionAttempts: integer("connection_attempts").default(0).notNull(),

    verifiedAt: timestamp("verified_at"),

    errorMessage: text("error_message"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // NOVO: Garante apenas 1 canal de cada tipo por organização
    unique("channel_org_type_unique").on(
      table.organizationId,
      table.channelType
    ),
    unique("channel_org_phone_unique").on(
      table.organizationId,
      table.phoneNumberId
    ),
    index("channel_org_idx").on(table.organizationId),
    index("channel_type_idx").on(table.channelType),
    index("channel_status_idx").on(table.status),
    index("channel_active_idx").on(table.isActive),
    // Composite index for fast active channel queries
    index("channel_active_status_idx").on(
      table.organizationId,
      table.isActive,
      table.status
    ),
  ]
);
