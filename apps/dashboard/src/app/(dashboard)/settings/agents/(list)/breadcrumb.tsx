"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { Cog } from "lucide-react";
import { SETTINGS_NAV_ITEMS } from "../../settings-config";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Configurações", icon: Cog },
        {
          type: "select",
          items: SETTINGS_NAV_ITEMS,
        },
      ]}
    />
  );
}
