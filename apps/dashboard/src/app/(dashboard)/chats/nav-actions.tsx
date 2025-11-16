"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@manylead/ui/button";
import { ChevronLeft } from "lucide-react";

export function NavActions() {
  const pathname = usePathname();
  const router = useRouter();
  const isOnChatPage = pathname.startsWith("/chats/") && pathname !== "/chats";

  if (isOnChatPage) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Voltar para conversas"
        onClick={() => router.push("/chats")}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
    );
  }

  return null;
}
