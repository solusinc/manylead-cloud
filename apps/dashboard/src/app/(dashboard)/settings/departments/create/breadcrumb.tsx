"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { Building2, Cog } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Configurações",
          href: "/settings",
          icon: Cog,
        },
        {
          type: "link",
          label: "Departamentos",
          href: "/settings/departments",
          icon: Building2,
        },
        { type: "page", label: "Criar Departamento" },
      ]}
    />
  );
}
