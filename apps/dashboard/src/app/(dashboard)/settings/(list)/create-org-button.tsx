"use client";

import { Button } from "@manylead/ui";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/lib/trpc/react";
import { useState } from "react";
import { Input } from "@manylead/ui";

export function CreateOrgButton() {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const createOrg = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: () => {
        // eslint-disable-next-line react-hooks/immutability -- needed for navigation
        window.location.href = "/overview";
      },
    }),
  );

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} size="sm">
        Criar Nova Organização (Teste)
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Nome da org"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        onClick={() => createOrg.mutate({ name })}
        disabled={createOrg.isPending || !name}
        size="sm"
      >
        {createOrg.isPending ? "Criando..." : "Criar"}
      </Button>
      <Button onClick={() => setIsOpen(false)} variant="outline" size="sm">
        Cancelar
      </Button>
    </div>
  );
}
