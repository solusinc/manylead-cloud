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
 * Tracks which organization is using which IP from the proxy pool.
 * For ISP proxies: 1 IP = 1 organization (dedicated).
 *
 * Flow:
 * 1. Channel created → allocate IP (find available ip_index)
 * 2. Channel deleted → release IP (status = 'released')
 * 3. Org creates new channel → reuse same IP if exists
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

    // IP index in the pool (0, 1, 2, ...)
    // Not the actual IP address - Bright Data manages IPs
    // We just track which "slot" in the pool this org is using
    ipIndex: integer("ip_index").notNull(),

    // Session ID used for this allocation
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

    // Unique constraint: 1 IP index = 1 active org per zone
    unique("proxy_ip_allocation_zone_ip_active_unique").on(
      table.proxyZoneId,
      table.ipIndex,
      table.status,
    ),
  ],
);
