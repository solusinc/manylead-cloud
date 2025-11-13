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
          label: "Departamentos",
          href: "/settings/departments",
        },
        { type: "page", label: "Criar Departamento" },
      ]}
    />
  );
}
