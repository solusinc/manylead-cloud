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

import { department } from "../departments/department";

/**
 * Channels - Canais WhatsApp via QR Code (Baileys)
 */
export const channel = pgTable(
  "channel",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),

    organizationId: text("organization_id").notNull(),

    // Departamento padrão (opcional)
    defaultDepartmentId: uuid("default_department_id").references(
      () => department.id,
      { onDelete: "set null" }
    ),

    // Identificação
    phoneNumberId: varchar("phone_number_id", { length: 100 })
      .notNull()
      .unique(),

    phoneNumber: varchar("phone_number", { length: 20 }),

    displayName: varchar("display_name", { length: 255 }).notNull(),

    profilePictureUrl: text("profile_picture_url"),

    // Status
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    // pending | connected | disconnected | error

    // Baileys
    authState: jsonb("auth_state").$type<{
      creds?: unknown;
      keys?: unknown;
    }>(),

    sessionData: jsonb("session_data").$type<{
      lastSeen?: string;
      platform?: string;
      deviceManufacturer?: string;
      deviceModel?: string;
    }>(),

    qrCode: text("qr_code"),

    qrCodeExpiresAt: timestamp("qr_code_expires_at"),

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
    unique("channel_org_phone_unique").on(
      table.organizationId,
      table.phoneNumberId
    ),
    index("channel_org_idx").on(table.organizationId),
    index("channel_status_idx").on(table.status),
    index("channel_active_idx").on(table.isActive),
    index("channel_department_idx").on(table.defaultDepartmentId),
    // Composite index for fast active channel queries
    index("channel_active_status_idx").on(
      table.organizationId,
      table.isActive,
      table.status
    ),
  ]
);
