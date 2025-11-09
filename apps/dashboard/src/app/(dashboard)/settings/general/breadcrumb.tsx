"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { Cog } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Configurações", icon: Cog },
        {
          type: "select",
          items: [{ value: "general", label: "Geral", icon: Cog }],
        },
      ]}
    />
  );
}
