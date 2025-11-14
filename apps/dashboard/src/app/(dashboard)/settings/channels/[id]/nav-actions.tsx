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

  const { data: channel } = useQuery(trpc.channels.getById.queryOptions({ id }));

  const deleteChannelMutation = useMutation(
    trpc.channels.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.channels.list.queryKey(),
        });
        if (pathname.includes(`/settings/channels/${id}`)) {
          router.push("/settings/channels");
        }
      },
    }),
  );

  if (!channel) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {can("manage", "Channel") && (
        <QuickActions
          actions={[]}
          deleteAction={{
            title: "Canal",
            confirmationValue: "deletar canal",
            submitAction: async () => {
              await deleteChannelMutation.mutateAsync({
                id,
              });
            },
          }}
        />
      )}
    </div>
  );
}
