import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Use DATABASE_URL for runtime queries (via PgBouncer if configured)
if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

// Create PostgreSQL connection
// Disable prepared statements for PgBouncer compatibility in transaction mode
export const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for PgBouncer in transaction mode
});

// Create Drizzle instance
export const db = drizzle({
  client,
  schema,
  casing: "snake_case",
});
