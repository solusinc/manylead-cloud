"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: ending } = useQuery(trpc.endings.getById.queryOptions({ id }));

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
          label: "Motivos de finalização",
          href: "/settings/endings",
        },
        {
          type: "page",
          label: ending?.title ?? "Carregando...",
        },
      ]}
    />
  );
}
