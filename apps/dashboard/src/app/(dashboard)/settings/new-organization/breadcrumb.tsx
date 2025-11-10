"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { Cog, Plus } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Configurações", icon: Cog },
        {
          type: "select",
          items: [{ value: "new-organization", label: "Criar Organização", icon: Plus }],
        },
      ]}
    />
  );
}
