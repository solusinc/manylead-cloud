import type { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { account, session, user, verification } from ".";

/**
 * User schemas
 */
export const selectUserSchema = createSelectSchema(user);
export const insertUserSchema = createInsertSchema(user);

/**
 * Session schemas
 */
export const selectSessionSchema = createSelectSchema(session);
export const insertSessionSchema = createInsertSchema(session);

/**
 * Account schemas
 */
export const selectAccountSchema = createSelectSchema(account);
export const insertAccountSchema = createInsertSchema(account);

/**
 * Verification schemas
 */
export const selectVerificationSchema = createSelectSchema(verification);
export const insertVerificationSchema = createInsertSchema(verification);

/**
 * Types
 */
export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;

export type Session = z.infer<typeof selectSessionSchema>;
export type NewSession = z.infer<typeof insertSessionSchema>;

export type Account = z.infer<typeof selectAccountSchema>;
export type NewAccount = z.infer<typeof insertAccountSchema>;

export type Verification = z.infer<typeof selectVerificationSchema>;
export type NewVerification = z.infer<typeof insertVerificationSchema>;
