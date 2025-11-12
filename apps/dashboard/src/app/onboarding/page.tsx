import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "~/lib/auth/server";
import { getQueryClient, trpc } from "~/lib/trpc/server";
import { OnboardingClient } from "./client";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Verifica se o usuário já tem uma organização (usando TRPC que filtra deletadas)
  const queryClient = getQueryClient();
  const organizations = await queryClient.fetchQuery(
    trpc.organization.list.queryOptions(),
  );

  if (organizations.length > 0) {
    // Se já tem org, redireciona para o dashboard
    redirect("/overview");
  }

  return <OnboardingClient />;
}
