import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { agent } from "./agent";
import { accessTypes, agentRoles } from "./constants";

/**
 * Enum schemas
 */
export const accessTypeSchema = z.enum(accessTypes);
export const agentRoleSchema = z.enum(agentRoles);

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
  role: agentRoleSchema,
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
  role: agentRoleSchema.default("member"),
  permissions: permissionsSchema.default({
    departments: { type: "all" },
    channels: { type: "all" },
  }),
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
export type AgentRole = z.infer<typeof agentRoleSchema>;
