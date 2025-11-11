"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Key, User } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui";
import type { Agent } from "@manylead/db";
import { useTRPC } from "~/lib/trpc/react";
import { useSession } from "~/lib/auth/client";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

const roleLabels = {
  owner: "Proprietário",
  admin: "Admin",
  member: "Operador",
} as const;

const roleIcons = {
  owner: Crown,
  admin: Key,
  member: User,
} as const;

interface RoleSelectCellProps {
  agent: AgentWithUser;
}

export function RoleSelectCell({ agent }: RoleSelectCellProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: agents } = useQuery(trpc.agents.list.queryOptions());

  const updateRoleMutation = useMutation(
    trpc.agents.updateRole.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });
      },
    }),
  );

  // Verificar se usuário logado é proprietário
  const currentUserAgent = agents?.find(
    (a: AgentWithUser) => a.userId === session?.user.id,
  );
  const currentUserIsOwner = currentUserAgent?.role === "owner";

  // Contar quantos proprietários existem
  const ownerCount = agents?.filter((a: AgentWithUser) => a.role === "owner").length ?? 0;

  // Se este agent é proprietário e é o último, não pode ser rebaixado
  const isLastOwner = agent.role === "owner" && ownerCount === 1;

  // Se não é proprietário logado, ou é o último proprietário, mostra apenas texto
  if (!currentUserIsOwner || isLastOwner) {
    const Icon = roleIcons[agent.role];
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{roleLabels[agent.role]}</span>
      </div>
    );
  }

  // Proprietário pode editar: mostra select
  const Icon = roleIcons[agent.role];

  return (
    <Select
      value={agent.role}
      disabled={isUpdating}
      onValueChange={async (newRole) => {
        setIsUpdating(true);
        try {
          await updateRoleMutation.mutateAsync({
            id: agent.id,
            role: newRole as "owner" | "admin" | "member",
          });
          toast.success("Cargo atualizado com sucesso");
        } catch (error) {
          toast.error("Erro ao atualizar cargo");
          console.error(error);
        } finally {
          setIsUpdating(false);
        }
      }}
    >
      <SelectTrigger className="h-8 w-[160px] border-0 bg-transparent hover:bg-accent">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm">{roleLabels[agent.role]}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span>Proprietário</span>
          </div>
        </SelectItem>
        <SelectItem value="admin">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span>Admin</span>
          </div>
        </SelectItem>
        <SelectItem value="member">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Operador</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
