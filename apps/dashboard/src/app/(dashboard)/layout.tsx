import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import type { AgentRole } from "@manylead/permissions";
import { SidebarInset, SidebarProvider } from "@manylead/ui/sidebar";

import { AppSidebar } from "~/components/nav/app-sidebar";
import { OrganizationGuard } from "~/components/nav/organization-guard";
import { SessionProvider } from "~/components/providers/session-provider";
import { auth } from "~/lib/auth/server";
import { AbilityProvider } from "~/lib/permissions";
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
  // O getCurrent já lida com setar a primeira org automaticamente se necessário
  const currentOrg = await queryClient.fetchQuery(
    trpc.organization.getCurrent.queryOptions(),
  );

  // Se não há organização ativa, redirecionar para a raiz
  if (!currentOrg) {
    redirect("/");
  }

  // Buscar agent atual para obter role (query eficiente - busca apenas 1 agent)
  const currentAgent = await queryClient.fetchQuery(
    trpc.agents.getByUserId.queryOptions({ userId: session.user.id }),
  );
  const role = (currentAgent?.role ?? "member") as AgentRole;

  const cookieStore = await cookies();
  const hasState = cookieStore.has("sidebar_state");
  const defaultOpen = hasState
    ? cookieStore.get("sidebar_state")?.value === "true"
    : true;

  return (
    <HydrateSidebar session={session}>
      <AbilityProvider role={role} userId={session.user.id}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </AbilityProvider>
    </HydrateSidebar>
  );
}

async function HydrateSidebar({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
}) {
  // Prefetch para garantir hidratação instantânea no client-side
  // DashboardLayout já fez fetchQuery, mas este prefetch garante que
  // NavUser e OrganizationSwitcher renderizem instantaneamente sem delay
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.organization.getCurrent.queryOptions());
  await queryClient.prefetchQuery(trpc.organization.list.queryOptions());
  await queryClient.prefetchQuery(trpc.agents.getCurrent.queryOptions());

  return (
    <SessionProvider session={session}>
      <HydrateClient>
        <OrganizationGuard />
        {children}
      </HydrateClient>
    </SessionProvider>
  );
}
