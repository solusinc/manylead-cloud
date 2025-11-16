"use client";

import { NavBreadcrumb } from "~/components/nav/nav-breadcrumb";
import { MessageSquare } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Conversas", icon: MessageSquare }]}
    />
  );
}
