"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";

export function Breadcrumb() {
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
          label: "Membros",
          href: "/settings/agents",
        },
        { type: "page", label: "Convidar Membro" },
      ]}
    />
  );
}
