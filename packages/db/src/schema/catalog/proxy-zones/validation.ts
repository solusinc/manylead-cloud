import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { proxyZone } from "./proxy-zone";

// Base schemas
export const selectProxyZoneSchema = createSelectSchema(proxyZone);
export const insertProxyZoneSchema = createInsertSchema(proxyZone);

// Update schema (partial, excludes encrypted fields - handled separately)
export const updateProxyZoneSchema = insertProxyZoneSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    passwordEncrypted: true,
    passwordIv: true,
    passwordTag: true,
  })
  .partial();

// Input schema for creating/updating zone (password as plain text, encrypted before save)
export const proxyZoneInputSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["isp", "residential"]),
  country: z.enum(["br", "us", "ca", "ar", "cl", "mx", "co", "pe", "pt", "es", "gb", "de", "fr"]),
  customerId: z.string().min(1).max(100),
  zone: z.string().min(1).max(100),
  host: z.string().default("brd.superproxy.io"),
  port: z.number().int().positive(),
  password: z.string().min(1), // Plain text - will be encrypted
  poolSize: z.number().int().positive().optional(),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  isDefault: z.boolean().default(false),
});

// Types
export type ProxyZone = z.infer<typeof selectProxyZoneSchema>;
export type InsertProxyZone = z.infer<typeof insertProxyZoneSchema>;
export type UpdateProxyZone = z.infer<typeof updateProxyZoneSchema>;
export type ProxyZoneInput = z.infer<typeof proxyZoneInputSchema>;
