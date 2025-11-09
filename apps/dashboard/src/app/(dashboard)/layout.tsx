import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { auth } from "~/lib/auth/server";
import { AppSidebar } from "~/components/nav/app-sidebar";
import { SidebarInset, SidebarProvider } from "@manylead/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((mod) => mod.headers()),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const hasState = cookieStore.has("sidebar_state");
  const defaultOpen = hasState
    ? cookieStore.get("sidebar_state")?.value === "true"
    : true;

  return (
    <HydrateSidebar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </HydrateSidebar>
  );
}

function HydrateSidebar({ children }: { children: React.ReactNode }) {
  // TODO: Implement TRPC prefetch queries
  // When implementing, make this function async and uncomment:
  // const queryClient = getQueryClient();
  // await queryClient.prefetchQuery(trpc.organizations.getCurrent.queryOptions());
  // await queryClient.prefetchQuery(trpc.organizations.list.queryOptions());
  // await queryClient.prefetchQuery(trpc.user.get.queryOptions());

  return <>{children}</>;
}
