"use client";

import { NavFeedback } from "~/components/nav/nav-feedback";
import { QuickActions } from "~/components/dropdowns/quick-actions";
import { useTRPC } from "~/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";

export function NavActions() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();

  const { data: department } = useQuery(
    trpc.departments.getById.queryOptions({ id }),
  );

  const deleteDepartmentMutation = useMutation(
    trpc.departments.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
        if (pathname.includes(`/settings/departments/${id}`)) {
          router.push("/settings/departments");
        }
      },
    }),
  );

  if (!department) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      <QuickActions
        actions={[]}
        deleteAction={{
          title: "Departamento",
          confirmationValue: "deletar departamento",
          submitAction: async () => {
            await deleteDepartmentMutation.mutateAsync({
              id,
            });
          },
        }}
      />
    </div>
  );
}
