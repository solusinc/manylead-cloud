/**
 * Organization Members - Constants and Enums
 */

export const organizationRoles = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];
