"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: invitation } = useQuery(trpc.invitation.getById.queryOptions({ id }));

  if (!invitation) return null;

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
        { type: "page", label: invitation.email },
      ]}
    />
  );
}
