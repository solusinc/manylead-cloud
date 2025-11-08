/**
 * Schema exports
 *
 * Organizado seguindo padrão OpenStatus:
 * - catalog: Schemas do catalog database (auth, tenants, metrics, logs)
 * - tenant: Schemas dos tenant databases (business data - FASE 2+)
 */

export * from "./catalog";
export * from "./tenant";
