import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "~/components/nav/app-header";
import { AppSidebarTrigger } from "~/components/nav/app-sidebar";
import { PermissionGuard } from "~/components/guards/permission-guard";
import type { Actions, Subjects } from "@manylead/permissions";

import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";
import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.member.list.queryOptions());
  await queryClient.prefetchQuery(trpc.invitation.list.queryOptions());

  return (
    <HydrateClient>
      <PermissionGuard action={"manage" satisfies Actions} subject={"Organization" satisfies Subjects}>
        <div>
          <AppHeader>
            <AppHeaderContent>
              <AppSidebarTrigger />
              <Breadcrumb />
            </AppHeaderContent>
            <AppHeaderActions>
              <NavActions />
            </AppHeaderActions>
          </AppHeader>
          <main className="w-full flex-1">{children}</main>
        </div>
      </PermissionGuard>
    </HydrateClient>
  );
}
