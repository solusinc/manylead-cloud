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
          label: "Motivos de finalização",
          href: "/settings/endings",
        },
        {
          type: "page",
          label: "Criar motivo",
        },
      ]}
    />
  );
}
