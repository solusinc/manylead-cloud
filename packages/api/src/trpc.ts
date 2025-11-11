/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { Auth } from "@manylead/auth";
import { db } from "@manylead/db/client";
import type { CatalogDB } from "@manylead/db/client";
import { TenantDatabaseManager } from "@manylead/tenant-db";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: Auth;
  req?: Request;
}): Promise<{
  authApi: Auth["api"];
  session: Awaited<ReturnType<Auth["api"]["getSession"]>>;
  db: CatalogDB;
  headers: Headers;
  req?: Request;
}> => {
  const authApi = opts.auth.api;
  const session = await authApi.getSession({
    headers: opts.headers,
  });
  return {
    authApi,
    session,
    db,
    headers: opts.headers,
    req: opts.req,
  };
};
/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  // Delay artificial removido - estava causando 5+ segundos de latência
  // if (t._config.isDev) {
  //   const waitMs = Math.floor(Math.random() * 400) + 100;
  //   await new Promise((resolve) => setTimeout(resolve, waitMs));
  // }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
/**
 * Middleware that enforces user is authenticated
 */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(enforceUserIsAuthed);

/**
 * Tenant Manager instance
 *
 * Use this to get tenant database connections in your routers.
 * Better Auth organization plugin handles organization data in catalog DB.
 * This manager provides access to isolated tenant databases.
 *
 * IMPORTANT: In Next.js dev mode, hot reload can recreate the module.
 * We use globalThis to preserve the connection cache across reloads.
 */
const globalForTenant = globalThis as unknown as {
  tenantManager: TenantDatabaseManager | undefined;
};

export const tenantManager: TenantDatabaseManager =
  globalForTenant.tenantManager ?? new TenantDatabaseManager();

if (process.env.NODE_ENV !== "production") {
  globalForTenant.tenantManager = tenantManager;
}

/**
 * 4. AUTHORIZATION PROCEDURES
 *
 * These procedures add role-based and permission-based authorization
 * on top of authentication. They automatically inject ability and agent
 * into the context.
 */
import { withAbility, requireRole } from "./middleware/authorization";

/**
 * Helper to create authorization procedures without type inference issues
 */
function createAuthProcedure() {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const newCtx = await withAbility(ctx);
    return next({ ctx: newCtx });
  });
}

function createRoleProcedure(role: "owner" | "admin" | "member") {
  return protectedProcedure.use(async ({ ctx, next }) => {
    const newCtx = await requireRole(role)(ctx);
    return next({ ctx: newCtx });
  });
}

/**
 * Authorized procedure
 *
 * Injects ability and agent into context. Use this when you need
 * to check permissions dynamically in your resolver.
 *
 * @example
 * ```ts
 * authorizedProcedure.query(({ ctx }) => {
 *   if (ctx.ability.can('read', 'Agent')) {
 *     // ...
 *   }
 * })
 * ```
 */
export const authorizedProcedure = createAuthProcedure();

/**
 * Owner-only procedure
 *
 * Only users with 'owner' role can access. Automatically enforced.
 *
 * @example
 * ```ts
 * ownerProcedure.mutation(({ ctx }) => {
 *   // ctx.agent.role is guaranteed to be 'owner'
 * })
 * ```
 */
export const ownerProcedure = createRoleProcedure("owner");

/**
 * Admin procedure (admin + owner)
 *
 * Users with 'admin' or 'owner' role can access.
 * Uses role hierarchy: owner > admin > member
 *
 * @example
 * ```ts
 * adminProcedure.mutation(({ ctx }) => {
 *   // ctx.agent.role is 'admin' or 'owner'
 * })
 * ```
 */
export const adminProcedure = createRoleProcedure("admin");

/**
 * Member procedure (all authenticated users)
 *
 * Any authenticated member of the organization can access.
 * This is essentially the same as authorizedProcedure but
 * explicitly requires 'member' role (lowest in hierarchy).
 *
 * @example
 * ```ts
 * memberProcedure.query(({ ctx }) => {
 *   // ctx.agent exists and has at least 'member' role
 * })
 * ```
 */
export const memberProcedure = createRoleProcedure("member");
