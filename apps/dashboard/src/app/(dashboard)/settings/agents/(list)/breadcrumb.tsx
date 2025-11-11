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
        { type: "page", label: "Membros", icon: Users },
      ]}
    />
  );
}
