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

  const { data: invitation } = useQuery(trpc.invitation.getById.queryOptions({ id }));

  const deleteInvitationMutation = useMutation(
    trpc.invitation.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.invitation.list.queryKey(),
        });
        if (pathname.includes(`/settings/users/invitations/${id}`)) {
          router.push("/settings/users");
        }
      },
    }),
  );

  if (!invitation) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Agent") && (
        <QuickActions
          actions={[]}
          deleteAction={{
            title: "Convite",
            submitAction: async () => {
              await deleteInvitationMutation.mutateAsync({
                id,
              });
            },
          }}
        />
      )}
    </div>
  );
}
