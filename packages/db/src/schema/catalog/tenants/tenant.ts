import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { databaseHost } from "../database-hosts";
import { tenantMetric } from "../tenant-metrics";
import { migrationLog } from "../migrations-log";
import { activityLog } from "../activity-logs";
import { organization } from "../auth/organization";
import { tenantStatus, tenantTier } from "./constants";

/**
 * Tenant table - Registro de todos os tenants
 *
 * Cada tenant tem seu próprio database PostgreSQL isolado
 */
export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    // Identificação
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),

    // Database
    databaseName: varchar("database_name", { length: 100 }).notNull().unique(),
    connectionString: text("connection_string").notNull(),

    // Database Host (FK)
    databaseHostId: uuid("database_host_id")
      .notNull()
      .references(() => databaseHost.id),

    // Campos denormalizados (cache do host)
    host: varchar("host", { length: 255 }).notNull(),
    port: integer("port").notNull().default(5432),
    region: varchar("region", { length: 50 }),
    // Região copiada do host (string livre)

    tier: varchar("tier", { length: 50, enum: tenantTier })
      .notNull()
      .default("shared"),

    // Status
    status: varchar("status", { length: 50, enum: tenantStatus })
      .notNull()
      .default("provisioning"),
    provisionedAt: timestamp("provisioned_at"),

    // Provisioning Details (para acompanhamento assíncrono)
    provisioningDetails: jsonb("provisioning_details").$type<{
      jobId?: string;
      progress?: number;
      currentStep?: string;
      steps?: {
        name: string;
        status: "pending" | "in_progress" | "completed" | "failed";
        startedAt?: string;
        completedAt?: string;
        error?: string;
      }[];
      startedAt?: string;
      completedAt?: string;
      error?: string;
    }>(),

    // Metadata
    metadata: jsonb("metadata").$type<{
      schemaVersion?: string;
      lastMigration?: string;
      features?: string[];
      limits?: {
        maxUsers?: number;
        maxChannels?: number;
        maxStorage?: number;
      };
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("tenant_organization_id_idx").on(table.organizationId),
    index("tenant_slug_idx").on(table.slug),
    index("tenant_status_idx").on(table.status),
    index("tenant_database_host_id_idx").on(table.databaseHostId),
    index("tenant_region_idx").on(table.region),
  ],
);

export const tenantRelations = relations(tenant, ({ one, many }) => ({
  organization: one(organization, {
    fields: [tenant.organizationId],
    references: [organization.id],
  }),
  databaseHost: one(databaseHost, {
    fields: [tenant.databaseHostId],
    references: [databaseHost.id],
  }),
  metrics: many(tenantMetric),
  migrationLogs: many(migrationLog),
  activityLogs: many(activityLog),
}));
