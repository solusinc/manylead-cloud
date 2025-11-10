"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Input } from "@manylead/ui";

import { useTRPC } from "~/lib/trpc/react";

export function CreateOrgButton() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const createOrg = useMutation(
    trpc.organization.create.mutationOptions({
      onSuccess: () => {
        // Invalidar queries para atualizar switcher imediatamente
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.organization.getCurrent.queryKey(),
        });
        router.push("/overview");
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
