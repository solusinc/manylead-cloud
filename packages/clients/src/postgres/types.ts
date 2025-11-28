import type postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;
export type PostgresOptions = Parameters<typeof postgres>[1];

export type PostgresConfigPreset =
  | "default" // Standard connection
  | "pgbouncer" // PgBouncer transaction mode
  | "admin" // Admin operations (CREATE DATABASE, etc.)
  | "migration" // Migration operations
  | "small-pool"; // Small connection pool

export interface CreatePostgresClientOptions {
  connectionString: string;
  preset?: PostgresConfigPreset;
  config?: Partial<PostgresOptions>;
  logger?: {
    info: (data: { preset?: string }, message: string) => void;
    debug: (data: { notice: unknown }, message: string) => void;
  };
}
