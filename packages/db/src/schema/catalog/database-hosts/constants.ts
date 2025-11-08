/**
 * Database host status values
 */
export const databaseHostStatus = [
  "active",
  "maintenance",
  "full",
  "offline",
] as const;

/**
 * Database host tier values
 */
export const databaseHostTier = ["shared", "dedicated", "enterprise"] as const;
