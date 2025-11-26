"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { FormCardGroup } from "~/components/forms/form-card";
import { useTRPC } from "~/lib/trpc/react";
import { FormGeneral } from "./form-general";

export function FormTagUpdate() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: tag, refetch } = useQuery(
    trpc.tags.getById.queryOptions({ id }),
  );

  const updateMutation = useMutation(
    trpc.tags.update.mutationOptions({
      onSuccess: () => {
        // Invalidate list query to update the tag in the list
        void queryClient.invalidateQueries({
          queryKey: trpc.tags.list.queryKey(),
        });
        void refetch();
        router.push("/settings/tags");
      },
    }),
  );

  if (!tag) return null;

  return (
    <FormCardGroup>
      <FormGeneral
        defaultValues={{
          name: tag.name,
          color: tag.color,
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
