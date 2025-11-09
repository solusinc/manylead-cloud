import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@manylead/auth";

import { env } from "~/env";

const baseUrl = env.AUTH_URL ?? "http://localhost:3000";

export const auth = initAuth({
  baseUrl,
  secret: env.AUTH_SECRET,
  extraPlugins: [nextCookies()],
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
