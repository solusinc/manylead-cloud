import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { agent } from "./agent";
import { accessTypes } from "./constants";

/**
 * Enum schemas
 */
export const accessTypeSchema = z.enum(accessTypes);

/**
 * Permission schemas
 */
const departmentsPermissionSchema = z.object({
  type: accessTypeSchema,
  ids: z.array(z.uuid()).optional(),
});

const channelsPermissionSchema = z.object({
  type: accessTypeSchema,
  ids: z.array(z.uuid()).optional(),
});

const permissionsSchema = z.object({
  departments: departmentsPermissionSchema,
  channels: channelsPermissionSchema,
});

/**
 * Select schema
 */
export const selectAgentSchema = createSelectSchema(agent, {
  departmentId: z
    .string()
    .uuid()
    .nullish()
    .transform((v) => (v === null ? undefined : v)),
  permissions: permissionsSchema,
});

/**
 * Insert schema
 */
export const insertAgentSchema = createInsertSchema(agent, {
  userId: z.string().min(1, "User ID é obrigatório"),
  permissions: permissionsSchema.default({
    departments: { type: "all" },
    channels: { type: "all" },
  }),
  maxActiveConversations: z.number().int().min(1).max(100).default(10),
});

/**
 * Update schema
 */
export const updateAgentSchema = insertAgentSchema.partial();

/**
 * Types
 */
export type Agent = z.infer<typeof selectAgentSchema>;
export type NewAgent = z.infer<typeof insertAgentSchema>;
export type UpdateAgent = z.infer<typeof updateAgentSchema>;
export type AgentPermissions = z.infer<typeof permissionsSchema>;
export type AccessType = z.infer<typeof accessTypeSchema>;
