"use client";

import { NavFeedback } from "~/components/nav/nav-feedback";
import { Button } from "@manylead/ui/button";
import Link from "next/link";
import { usePermissions } from "~/lib/permissions";

export function NavActions() {
  const { can } = usePermissions();

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Department") && (
        <Button size="sm" asChild>
          <Link href="/settings/departments/create">Criar departamento</Link>
        </Button>
      )}
    </div>
  );
}
