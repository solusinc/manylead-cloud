/**
 * Tenant Database Schemas
 *
 * Schemas para os databases isolados de cada tenant.
 * Os schemas de organization, member e invitation agora estão no catalog DB
 * gerenciados pelo Better Auth.
 */

// Organization Settings
export * from "./organization-settings";

// Departments
export * from "./departments";

// Agents
export * from "./agents";

// Channels
export * from "./channels";
