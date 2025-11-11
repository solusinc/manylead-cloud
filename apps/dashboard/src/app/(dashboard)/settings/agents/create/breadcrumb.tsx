"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { Cog, Users } from "lucide-react";

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
          label: "Membros",
          href: "/settings/agents",
          icon: Users,
        },
        { type: "page", label: "Convidar Membro" },
      ]}
    />
  );
}
