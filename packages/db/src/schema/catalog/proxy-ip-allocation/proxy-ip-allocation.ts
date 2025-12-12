import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  varchar,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

import { organization } from "../auth/organization";
import { proxyZone } from "../proxy-zones/proxy-zone";
import { proxyIpAllocationStatus } from "./constants";

/**
 * Proxy IP Allocation table
 *
 * Tracks which organization is using a dedicated IP from the proxy pool.
 * For ISP proxies: 1 session ID = 1 dedicated IP (managed by Bright Data).
 *
 * Flow:
 * 1. Channel created → allocate session ID (gets dedicated IP from Bright Data)
 * 2. Channel deleted → release allocation (status = 'released')
 * 3. Org creates new channel → reuse same allocation if exists
 */
export const proxyIpAllocation = pgTable(
  "proxy_ip_allocation",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),

    // Organization using this IP
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Proxy zone
    proxyZoneId: uuid("proxy_zone_id")
      .notNull()
      .references(() => proxyZone.id, { onDelete: "cascade" }),

    // Session ID used for this allocation
    // Each session ID gets a dedicated IP from Bright Data automatically
    sessionId: text("session_id").notNull(),

    // Allocation status
    status: varchar("status", { length: 20, enum: proxyIpAllocationStatus })
      .notNull()
      .default("active"),

    // Timestamps
    allocatedAt: timestamp("allocated_at").notNull().defaultNow(),
    releasedAt: timestamp("released_at"),
  },
  (table) => [
    // Indexes for fast lookups
    index("proxy_ip_allocation_org_idx").on(table.organizationId),
    index("proxy_ip_allocation_zone_idx").on(table.proxyZoneId),
    index("proxy_ip_allocation_status_idx").on(table.status),

    // Unique constraint: 1 active allocation per org per zone
    unique("proxy_ip_allocation_org_zone_active_unique").on(
      table.organizationId,
      table.proxyZoneId,
      table.status,
    ),
  ],
);
