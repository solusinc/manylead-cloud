import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, organization } from "better-auth/plugins";

import { db, eq, organization as organizationTable } from "@manylead/db";
import { createLogger } from "@manylead/clients/logger";

const logger = createLogger({ component: "BetterAuth" });

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  secret: string | undefined;
  extraPlugins?: TExtraPlugins;
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: {
      enabled: true,
    },
    // TODO: se quiser manter o controle do id (nanoid) para usar uuid
    // advanced: {
    //     database: {
    //         generateId: false,
    //     }
    // },
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 10,
        membershipLimit: 100,
        creatorRole: "owner",
      }),
      ...(options.extraPlugins ?? []),
    ],
    onAPIError: {
      onError(error, ctx) {
        logger.error({ err: error, ctx }, "Better Auth API error");
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth({
    ...config,
    plugins: [
      ...config.plugins,
      customSession(async ({ user, session }) => {
        let organizationInstanceCode: string | null = null;

        const sessionWithOrg = session as typeof session & {
          activeOrganizationId?: string | null;
        };

        if (sessionWithOrg.activeOrganizationId) {
          const org = await db
            .select({ instanceCode: organizationTable.instanceCode })
            .from(organizationTable)
            .where(eq(organizationTable.id, sessionWithOrg.activeOrganizationId))
            .limit(1);

          organizationInstanceCode = org[0]?.instanceCode ?? null;
        }

        return {
          user,
          session,
          organizationInstanceCode,
        };
      }, config),
    ],
  });
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
