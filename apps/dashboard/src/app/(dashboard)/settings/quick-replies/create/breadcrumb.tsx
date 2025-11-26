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
          label: "Respostas rápidas",
          href: "/settings/quick-replies",
        },
        {
          type: "page",
          label: "Criar resposta rápida",
        },
      ]}
    />
  );
}
