import type { Socket } from "socket.io";

/**
 * Validate that user belongs to an organization
 *
 * @param socket - Socket.io socket
 * @param organizationId - Organization ID to validate
 * @returns True if user belongs to organization
 */
export function validateOrganizationAccess(
  socket: Socket,
  organizationId: string,
): boolean {
  const { organizationIds } = socket.data as { organizationIds?: string[] };

  if (!organizationIds || !Array.isArray(organizationIds)) {
    return false;
  }

  return organizationIds.includes(organizationId);
}

/**
 * Middleware to validate organization access before joining room
 *
 * @param socket - Socket.io socket
 * @param organizationId - Organization ID
 * @param next - Callback
 */
export function validateOrganizationMiddleware(
  socket: Socket,
  organizationId: string,
  next: (err?: Error) => void,
) {
  if (!validateOrganizationAccess(socket, organizationId)) {
    return next(
      new Error(`Unauthorized access to organization: ${organizationId}`),
    );
  }

  next();
}
