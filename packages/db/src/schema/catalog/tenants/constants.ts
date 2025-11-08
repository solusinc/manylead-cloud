/**
 * Tenant status values
 */
export const tenantStatus = [
  "provisioning",
  "active",
  "suspended",
  "deleted",
  "failed",
] as const;

/**
 * Tenant tier values
 */
export const tenantTier = ["shared", "dedicated", "enterprise"] as const;
