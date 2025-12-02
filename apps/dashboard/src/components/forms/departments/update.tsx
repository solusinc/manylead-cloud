"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { FormCardGroup } from "~/components/forms/form-card";
import { useTRPC } from "~/lib/trpc/react";
import { FormGeneral } from "./form-general";

export function FormDepartmentUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: department, refetch } = useQuery(
    trpc.departments.getById.queryOptions({ id }),
  );

  const updateMutation = useMutation(
    trpc.departments.update.mutationOptions({
      onSuccess: () => {
        // Invalidate list query to update the department in the list
        void queryClient.invalidateQueries({
          queryKey: trpc.departments.list.queryKey(),
        });
        void refetch();
        router.push("/settings/departments");
      },
    }),
  );

  if (!department) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          name: department.name,
          isDefault: department.isDefault,
        }}
        onSubmitAction={async (values) => {
          await updateMutation.mutateAsync({
            id,
            data: values,
          });
        }}
      />
    </FormCardGroup>
  );
}
