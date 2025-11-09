import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "@manylead/db/client";
import { TenantDatabaseManager } from "@manylead/tenant-db";

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  secret: string | undefined;
  extraPlugins?: TExtraPlugins;
}) {
  const tenantManager = new TenantDatabaseManager();

  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    plugins: [
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 10,
        membershipLimit: 100,
        creatorRole: "owner",
        organizationHooks: {
          /**
           * Hook: After creating organization
           * Provisiona o tenant database automaticamente
           */
          afterCreateOrganization: async ({ organization }) => {
            console.log(
              `[Better Auth Hook] Provisioning tenant for organization: ${organization.id}`,
            );

            try {
              await tenantManager.provisionTenant({
                organizationId: organization.id,
                slug: organization.slug || `org-${organization.id}`,
                name: organization.name,
              });

              console.log(
                `[Better Auth Hook] Tenant provisioned successfully for: ${organization.id}`,
              );
            } catch (error) {
              console.error(
                `[Better Auth Hook] Failed to provision tenant for: ${organization.id}`,
                error,
              );
              // Não lançamos o erro para não bloquear a criação da org
              // O tenant pode ser provisionado manualmente depois
            }
          },

          /**
           * Hook: Before deleting organization
           * Remove o tenant database automaticamente
           */
          beforeDeleteOrganization: async ({ organization }) => {
            console.log(
              `[Better Auth Hook] Deleting tenant for organization: ${organization.id}`,
            );

            try {
              await tenantManager.deleteTenant(organization.id);

              console.log(
                `[Better Auth Hook] Tenant deleted successfully for: ${organization.id}`,
              );
            } catch (error) {
              console.error(
                `[Better Auth Hook] Failed to delete tenant for: ${organization.id}`,
                error,
              );
              // Logamos mas não bloqueamos a deleção da org
            }
          },
        },
      }),
      ...(options.extraPlugins ?? []),
    ],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
