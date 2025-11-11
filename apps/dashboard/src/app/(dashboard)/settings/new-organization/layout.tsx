import {
  AppHeader,
  AppHeaderActions,
  AppHeaderContent,
} from "~/components/nav/app-header";
import { AppSidebarTrigger } from "~/components/nav/app-sidebar";
import { PermissionGuard } from "~/components/guards/permission-guard";
import type { Actions, Subjects } from "@manylead/permissions";

import { HydrateClient } from "~/lib/trpc/server";
import { Breadcrumb } from "./breadcrumb";
import { NavActions } from "./nav-actions";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HydrateClient>
      <PermissionGuard action={"create" satisfies Actions} subject={"Organization" satisfies Subjects}>
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
