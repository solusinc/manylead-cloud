import type { Socket } from "socket.io";
import { and, db, eq, gt, member, session as sessionSchema } from "@manylead/db";

import type { SocketData } from "../types";

/**
 * Socket.io authentication middleware
 * Validates session token and attaches user info to socket
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    // Validate session token by querying the database
    const sessions = await db
      .select({
        id: sessionSchema.id,
        userId: sessionSchema.userId,
        expiresAt: sessionSchema.expiresAt,
      })
      .from(sessionSchema)
      .where(
        and(
          eq(sessionSchema.token, token),
          gt(sessionSchema.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const validSession = sessions[0];

    if (!validSession) {
      return next(new Error("Invalid or expired token"));
    }

    // Fetch user's organizations from database
    const userOrganizations = await db
      .select({
        organizationId: member.organizationId,
      })
      .from(member)
      .where(eq(member.userId, validSession.userId));

    const organizationIds = userOrganizations.map((m) => m.organizationId);

    // Attach user info to socket data
    const socketData: SocketData = {
      userId: validSession.userId,
      userEmail: undefined, // Email não está disponível neste contexto
      organizationIds,
    };
    Object.assign(socket.data, socketData);

    next();
  } catch (error) {
    console.error("[Socket.io] Authentication error:", error);
    next(new Error("Authentication failed"));
  }
}
