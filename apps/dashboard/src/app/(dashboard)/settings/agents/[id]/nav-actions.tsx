"use client";

import { NavFeedback } from "~/components/nav/nav-feedback";
import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";
import { usePermissions } from "~/lib/permissions";

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = usePermissions();

  const { data: agent } = useQuery(trpc.agents.getById.queryOptions({ id }));

  const deleteAgentMutation = useMutation(
    trpc.agents.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.agents.list.queryKey(),
        });
        if (pathname.includes(`/settings/agents/${id}`)) {
          router.push("/settings/agents");
        }
      },
    }),
  );

  if (!agent) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Agent") && (
        <QuickActions
          actions={[]}
          deleteAction={{
            title: "Membro",
            confirmationValue: "deletar membro",
            submitAction: async () => {
              await deleteAgentMutation.mutateAsync({
                id,
              });
            },
          }}
        />
      )}
    </div>
  );
}
