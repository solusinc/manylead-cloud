"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: tag } = useQuery(trpc.tags.getById.queryOptions({ id }));

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Configuracoes",
          href: "/settings",
        },
        {
          type: "link",
          label: "Etiquetas",
          href: "/settings/tags",
        },
        {
          type: "page",
          label: tag?.name ?? "Carregando...",
        },
      ]}
    />
  );
}
