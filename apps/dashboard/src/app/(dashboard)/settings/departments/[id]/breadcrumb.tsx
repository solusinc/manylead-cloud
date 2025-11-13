"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: department } = useQuery(
    trpc.departments.getById.queryOptions({ id }),
  );

  if (!department) return null;

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
          label: "Departamentos",
          href: "/settings/departments",
        },
        { type: "page", label: department.name },
      ]}
    />
  );
}
