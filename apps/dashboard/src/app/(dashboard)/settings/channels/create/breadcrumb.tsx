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
          label: "Canais",
          href: "/settings/channels",
        },
        { type: "page", label: "Conectar canal" },
      ]}
    />
  );
}
