"use client";

import Link from "next/link";
import { Button } from "@manylead/ui/button";
import { NavFeedback } from "~/components/nav/nav-feedback";
import { usePermissions } from "~/lib/permissions";

export function NavActions() {
  const { can } = usePermissions();

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Ending") && (
        <Button size="sm" asChild>
          <Link href="/settings/endings/create">Criar motivo</Link>
        </Button>
      )}
    </div>
  );
}
