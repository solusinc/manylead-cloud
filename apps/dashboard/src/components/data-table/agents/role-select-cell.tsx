"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Key, User } from "lucide-react";
import { toast } from "sonner";

import type { Agent } from "@manylead/db";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@manylead/ui";

import { useSession } from "~/lib/auth/client";
import { useTRPC } from "~/lib/trpc/react";
import { usePermissions } from "~/lib/permissions";

type AgentWithUser = Agent & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

const roleLabels = {
  owner: "Administrador",
  admin: "Supervisor",
  member: "Agente",
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
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const { can } = usePermissions();

  const { data: agents } = useQuery(trpc.agents.list.queryOptions());

  const updateRoleMutation = useMutation(
    trpc.agents.updateRole.mutationOptions({
      onSuccess: () => {
        // Invalidar lista de agents
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });

        // Invalidar cache de agents.getByUserId para o usuário afetado
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.getByUserId.queryKey({ userId: agent.userId }),
        });

        // Se alterou o próprio usuário, forçar reload para atualizar permissões
        if (agent.userId === session?.user.id) {
          toast.success("Seu cargo foi atualizado. Recarregando página...");
          setTimeout(() => {
            router.refresh();
          }, 1000);
        }
      },
    }),
  );

  // Verificar se usuário logado é administrador
  const currentUserAgent = agents?.find(
    (a: AgentWithUser) => a.userId === session?.user.id,
  );
  const currentUserIsOwner = currentUserAgent?.role === "owner";

  // Contar quantos administradores existem
  const ownerCount =
    agents?.filter((a: AgentWithUser) => a.role === "owner").length ?? 0;

  // Se este agent é administrador e é o último, não pode ser rebaixado
  const isLastOwner = agent.role === "owner" && ownerCount === 1;

  // Se não tem permissão manage Agent, não é administrador logado, ou é o último administrador, mostra apenas texto
  if (!can("manage", "Agent") || !currentUserIsOwner || isLastOwner) {
    const Icon = roleIcons[agent.role];
    return (
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground h-4 w-4" />
        <span>{roleLabels[agent.role]}</span>
      </div>
    );
  }

  // Administrador pode editar: mostra select
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
      <SelectTrigger className="hover:bg-accent h-8 w-40 border-0 bg-transparent">
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
            <span>Administrador</span>
          </div>
        </SelectItem>
        <SelectItem value="admin">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span>Supervisor</span>
          </div>
        </SelectItem>
        <SelectItem value="member">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Agente</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
