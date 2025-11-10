"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { useTRPC } from "~/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
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
          label: "Departamentos",
          href: "/settings/departments",
          icon: Building2,
        },
        { type: "page", label: department.name },
      ]}
    />
  );
}
