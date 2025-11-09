/**
 * Organization Invitations - Constants and Enums
 */

export const invitationStatuses = ["pending", "accepted", "expired", "canceled"] as const;
export type InvitationStatus = (typeof invitationStatuses)[number];
