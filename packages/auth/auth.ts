/**
 * Better Auth configuration for CLI migrations
 *
 * This file is used by @better-auth/cli for database migrations.
 * Usage: cd packages/auth && npx @better-auth/cli migrate
 */
import { initAuth } from "./src/index";

export const auth = initAuth({
  baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.AUTH_SECRET,
});
