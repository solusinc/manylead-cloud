"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc/react";

/**
 * Guard global que monitora se o usuário foi removido de todas as organizações
 * e redireciona ANTES dos componentes sumirem
 */
export function OrganizationGuard() {
  const router = useRouter();
  const trpc = useTRPC();

  const { data: organization, isLoading: isLoadingOrg } = useQuery({
    ...trpc.organization.getCurrent.queryOptions(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: organizations, isLoading: isLoadingOrgs } = useQuery({
    ...trpc.organization.list.queryOptions(),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  useEffect(() => {
    // Aguardar queries carregarem
    if (isLoadingOrg || isLoadingOrgs) return;

    const activeOrg = organization ?? organizations?.[0];

    // Se não há org ativa, redirecionar imediatamente
    if (!activeOrg) {
      router.push("/");
    }
  }, [organization, organizations, isLoadingOrg, isLoadingOrgs, router]);

  // Componente não renderiza nada, apenas monitora
  return null;
}
