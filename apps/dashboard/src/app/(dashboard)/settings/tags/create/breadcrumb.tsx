"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Configuracoes",
          href: "/settings",
        },
        {
          type: "link",
          label: "Etiquetas",
          href: "/settings/tags",
        },
        {
          type: "page",
          label: "Criar etiqueta",
        },
      ]}
    />
  );
}
