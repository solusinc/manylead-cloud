"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { FormCardGroup } from "~/components/forms/form-card";
import { FormGeneral } from "./form-general";
import { useTRPC } from "~/lib/trpc/react";

export function FormAgentUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));
  const { data: allAgents = [] } = useQuery(trpc.agents.list.queryOptions());

  // Verificar se é o último proprietário
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
        router.push("/settings/agents");
      },
    }),
  );

  if (!agent) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          email: agent.user?.email ?? "",
          role: agent.role,
          isActive: agent.isActive,
          departmentIds:
            agent.permissions.departments.type === "specific"
              ? agent.permissions.departments.ids ?? []
              : [],
        }}
        onSubmit={async (values) => {
          const departmentAccess =
            values.departmentIds.length > 0 ? "specific" : "all";

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
    </FormCardGroup>
  );
}
