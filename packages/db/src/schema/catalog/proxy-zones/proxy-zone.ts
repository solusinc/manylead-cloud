import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { proxyType, proxyCountry, proxyZoneStatus } from "./constants";

/**
 * Proxy Zones table - Bright Data proxy zone credentials
 *
 * Stores proxy zone configurations for different countries/types.
 * Allows adding new zones without code deployment.
 *
 * Password is encrypted using AES-256-GCM (via @manylead/crypto package)
 */
export const proxyZone = pgTable(
  "proxy_zone",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    // Zone identification
    name: varchar("name", { length: 100 }).notNull().unique(),
    // Ex: "manylead_isp_br", "manylead_residential"

    // Proxy type
    type: varchar("type", { length: 20, enum: proxyType }).notNull(),
    // "isp" = dedicated IPs, "residential" = dynamic IPs

    // Country (for ISP zones - each country needs separate zone)
    // For residential, this is the default country but can be overridden per-request
    country: varchar("country", { length: 5, enum: proxyCountry }).notNull(),

    // Bright Data credentials
    customerId: varchar("customer_id", { length: 100 }).notNull(),
    // Ex: "hl_b91d78ff"

    zone: varchar("zone", { length: 100 }).notNull(),
    // Ex: "manylead_isp_br", "manylead_residential"

    // Connection
    host: varchar("host", { length: 255 }).notNull().default("brd.superproxy.io"),
    port: integer("port").notNull(),
    // ISP: 33335, Residential: 22225

    // Encrypted password (AES-256-GCM)
    passwordEncrypted: text("password_encrypted").notNull(),
    passwordIv: varchar("password_iv", { length: 64 }).notNull(),
    passwordTag: varchar("password_tag", { length: 64 }).notNull(),

    // ISP-specific: IP pool size
    poolSize: integer("pool_size"),
    // Ex: 10 IPs in the zone

    // Status
    status: varchar("status", { length: 20, enum: proxyZoneStatus })
      .notNull()
      .default("active"),

    isDefault: boolean("is_default").default(false),
    // If true, this zone is used as default for its type/country combination

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("proxy_zone_type_idx").on(table.type),
    index("proxy_zone_country_idx").on(table.country),
    index("proxy_zone_status_idx").on(table.status),
    index("proxy_zone_type_country_idx").on(table.type, table.country),
  ],
);
