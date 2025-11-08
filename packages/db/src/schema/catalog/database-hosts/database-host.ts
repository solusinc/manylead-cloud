import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

import { tenant } from "../tenants";
import { databaseHostStatus, databaseHostTier } from "./constants";

/**
 * Database Host table - Gerenciamento de servidores PostgreSQL
 *
 * Permite adicionar/remover hosts dinamicamente sem mudança de código
 */
export const databaseHost = pgTable(
  "database_host",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Identificação
    name: varchar("name", { length: 100 }).notNull().unique(),
    // Ex: "postgres-br-primary", "postgres-us-east-1"

    // Conexão
    host: varchar("host", { length: 255 }).notNull(),
    // Ex: "148.113.164.109", "postgres-br.manylead.com"

    port: integer("port").notNull().default(5432),

    // Classificação
    region: varchar("region", { length: 50 }).notNull(),
    // Ex: "br-sao-paulo", "us-east-1" (string livre)

    tier: varchar("tier", { length: 50, enum: databaseHostTier })
      .notNull()
      .default("shared"),

    // Capacidade
    maxTenants: integer("max_tenants").notNull().default(70),
    currentTenants: integer("current_tenants").notNull().default(0),

    diskCapacityGb: integer("disk_capacity_gb").notNull(),
    diskUsageGb: integer("disk_usage_gb").notNull().default(0),

    // Status
    status: varchar("status", { length: 50, enum: databaseHostStatus })
      .notNull()
      .default("active"),

    isDefault: boolean("is_default").default(false),
    // Define qual é o host padrão para novos tenants

    // Metadata
    capabilities: jsonb("capabilities").$type<{
      pgVersion?: string;
      extensions?: string[];
      features?: string[];
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    lastHealthCheck: timestamp("last_health_check"),
  },
  (table) => [
    index("database_host_name_idx").on(table.name),
    index("database_host_region_idx").on(table.region),
    index("database_host_status_idx").on(table.status),
    index("database_host_tier_idx").on(table.tier),
  ],
);

export const databaseHostRelations = relations(databaseHost, ({ many }) => ({
  tenants: many(tenant),
}));
