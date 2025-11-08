/**
 * Activity log actions
 */
export const activityLogAction = [
  "tenant.created",
  "tenant.provisioned",
  "tenant.updated",
  "tenant.deleted",
  "tenant.suspended",
  "tenant.activated",
  "migration.executed",
  "migration.failed",
  "host.created",
  "host.updated",
  "host.deleted",
  "host.maintenance",
  "system.error",
  "security.breach",
] as const;

/**
 * Activity log categories
 */
export const activityLogCategory = [
  "tenant",
  "migration",
  "host",
  "user",
  "system",
  "security",
] as const;

/**
 * Activity log severity levels
 */
export const activityLogSeverity = ["info", "warning", "error", "critical"] as const;
