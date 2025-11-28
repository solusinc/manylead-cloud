import { TenantDatabaseManager } from "@manylead/tenant-db";

/**
 * Singleton instance of TenantDatabaseManager
 *
 * Shared across all workers to reuse connection pools and avoid
 * overhead of multiple initializations.
 *
 * The TenantDatabaseManager handles:
 * - Creating tenant databases
 * - Managing tenant connections
 * - Running migrations
 * - Tenant status updates
 */
export const tenantManager = new TenantDatabaseManager();
