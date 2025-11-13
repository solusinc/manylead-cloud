"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { FormGeneral } from "./form-general";
import { useTRPC } from "~/lib/trpc/react";

export function FormAgentUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));
  const { data: allAgents = [] } = useQuery(trpc.agents.list.queryOptions());

  // Verificar se é o último administrador
  const isLastOwner =
    agent?.role === "owner" &&
    allAgents.filter((a) => a.role === "owner").length === 1;

  const updateMutation = useMutation(
    trpc.agents.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.getById.queryKey({ id }),
        });
        router.push("/settings/users");
      },
    }),
  );

  if (!agent) return null;

  return (
    <FormGeneral
      defaultValues={{
        email: agent.user?.email ?? "",
        role: agent.role,
        isActive: agent.isActive,
        restrictDepartments: agent.permissions.departments.type === "specific",
        departmentIds:
          agent.permissions.departments.type === "specific"
            ? agent.permissions.departments.ids ?? []
            : [],
      }}
      onSubmit={async (values) => {
        const departmentAccess = values.restrictDepartments ? "specific" : "all";

        await updateMutation.mutateAsync({
          id,
          data: {
            role: values.role,
            isActive: values.isActive,
            permissions: {
              ...agent.permissions,
              departments:
                departmentAccess === "specific"
                  ? { type: "specific", ids: values.departmentIds }
                  : { type: "all" },
            },
          },
        });
      }}
      isLastOwner={isLastOwner}
    />
  );
}
