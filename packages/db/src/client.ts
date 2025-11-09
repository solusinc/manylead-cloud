import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as catalogSchema from "./schema/catalog";
import * as tenantSchema from "./schema/tenant";

/**
 * Cria cliente para o catalog database
 *
 * @param connectionString - Connection string customizada (opcional)
 * @param options - Opções adicionais
 * @returns Drizzle client configurado para o catalog
 */
export function createCatalogClient(
  connectionString?: string,
  options?: { prepare?: boolean; timeout?: number }
) {
  const connString = connectionString ?? process.env.DATABASE_URL;

  if (!connString) {
    throw new Error("Missing DATABASE_URL or connectionString");
  }

  const client = postgres(connString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: options?.timeout ?? 10,
    // prepare: false é necessário para PgBouncer em transaction mode
    // prepare: true é necessário para suportar transações do Better Auth
    prepare: options?.prepare ?? false,
  });

  return drizzle({
    client,
    schema: catalogSchema,
    casing: "snake_case",
  });
}

/**
 * Cria cliente para um tenant database específico
 *
 * @param connectionString - Connection string do tenant database
 * @returns Drizzle client configurado para o tenant
 */
export function createTenantClient(connectionString: string) {
  if (!connectionString) {
    throw new Error("Missing tenant connectionString");
  }

  const client = postgres(connectionString, {
    max: 3, // Limite baixo por tenant (pgBouncer gerencia pool)
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return drizzle({
    client,
    schema: tenantSchema,
    casing: "snake_case",
  });
}

// Export types
export type CatalogDB = ReturnType<typeof createCatalogClient>;
export type TenantDB = ReturnType<typeof createTenantClient>;

/**
 * Instância singleton do catalog client
 * Usa DATABASE_URL por padrão (via PgBouncer)
 *
 * Note: PgBouncer em transaction mode não suporta prepared statements,
 * então prepare: false. Better Auth detecta isso e executa operações
 * sequencialmente ao invés de usar transações.
 */
export const db: CatalogDB = createCatalogClient();
