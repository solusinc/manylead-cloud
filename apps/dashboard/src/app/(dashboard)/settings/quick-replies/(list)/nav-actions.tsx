"use client";

import Link from "next/link";

import { Button } from "@manylead/ui/button";

import { NavFeedback } from "~/components/nav/nav-feedback";

export function NavActions() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <Button size="sm" asChild>
        <Link href="/settings/quick-replies/create">Criar resposta rápida</Link>
      </Button>
    </div>
  );
}
