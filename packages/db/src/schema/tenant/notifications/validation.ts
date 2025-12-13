import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { notification } from "./notification";

// Schemas de validação com Zod
export const insertNotificationSchema = createInsertSchema(notification, {
  title: z.string().min(1).max(255),
  message: z.string().min(1),
  type: z.enum([
    "billing",
    "plan_expiring",
    "member_promoted",
    "member_removed",
    "chat_assigned",
    "system",
  ]),
  actionUrl: z.string().optional(),
  targetUserId: z.string().optional(),
  visibleToRoles: z
    .array(z.enum(["owner", "admin", "member"]))
    .optional()
    .nullable(),
});

export const selectNotificationSchema = createSelectSchema(notification);

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SelectNotification = z.infer<typeof selectNotificationSchema>;
