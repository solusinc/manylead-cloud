"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: quickReply } = useQuery(
    trpc.quickReplies.getById.queryOptions({ id }),
  );

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
          label: "Respostas rápidas",
          href: "/settings/quick-replies",
        },
        {
          type: "page",
          label: quickReply?.title ?? "Carregando...",
        },
      ]}
    />
  );
}
