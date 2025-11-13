"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));

  if (!agent) return null;

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Configurações",
          href: "/settings",
        },
        {
          type: "link",
          label: "Usuários",
          href: "/settings/users",
        },
        { type: "page", label: agent.user?.name ?? agent.user?.email ?? "Usuário" },
      ]}
    />
  );
}
