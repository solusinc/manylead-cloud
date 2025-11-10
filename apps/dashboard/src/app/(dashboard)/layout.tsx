import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@manylead/ui/sidebar";

import { AppSidebar } from "~/components/nav/app-sidebar";
import { auth } from "~/lib/auth/server";
import { HydrateClient, getQueryClient, trpc } from "~/lib/trpc/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Verificar se o usuário tem organizações
  const queryClient = getQueryClient();
  const organizations = await queryClient.fetchQuery(
    trpc.organization.list.queryOptions(),
  );

  // Se não tem organizações, redirecionar para onboarding
  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  // Verificar se há organização ativa
  const currentOrg = await queryClient.fetchQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Se não há organização ativa, redirecionar para a raiz
  if (!currentOrg) {
    redirect("/");
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

async function HydrateSidebar({ children }: { children: React.ReactNode }) {
  // Prefetch organization data for the sidebar
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.organization.getCurrent.queryOptions());
  await queryClient.prefetchQuery(trpc.organization.list.queryOptions());

  return <HydrateClient>{children}</HydrateClient>;
}
