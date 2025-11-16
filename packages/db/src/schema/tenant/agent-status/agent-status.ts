import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { agent } from "../agents/agent";

/**
 * Agent Status - Status de presença dos agents
 *
 * Rastreia se o agent está disponível, ocupado ou offline
 * Usado para auto-assignment baseado em disponibilidade
 */
export const agentStatus = pgTable("agent_status", {
  agentId: uuid("agent_id")
    .primaryKey()
    .references(() => agent.id, { onDelete: "cascade" }),

  status: varchar("status", { length: 20 }).notNull().default("offline"),
  // "available" | "busy" | "offline"

  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  // Último heartbeat recebido

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
