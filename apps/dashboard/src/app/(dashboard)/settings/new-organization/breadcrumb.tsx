"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { SETTINGS_NAV_ITEMS } from "../settings-config";

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
          type: "select",
          items: SETTINGS_NAV_ITEMS,
        },
      ]}
    />
  );
}
